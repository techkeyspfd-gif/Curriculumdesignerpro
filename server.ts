import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load .env first, then let .env.local override it (matches Vite's env convention).
// The base `dotenv/config` import only reads `.env`, so a key placed in
// .env.local — as the README instructs — would otherwise be ignored locally.
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

// Builds the student-adaptation block shared by every generation prompt.
// When learning needs are present it includes concrete, evidence-based practices
// (written with autistic learners especially in mind) rather than a vague
// "accommodate these needs" instruction.
function buildStudentContext(learningNeeds?: string, interests?: string): string {
  let text = '';
  if (learningNeeds) {
    text += `
Student Learning Needs & Traits: ${learningNeeds}
Adapt tone, structure, content format, and suggestions to these needs throughout. If the student is autistic or otherwise neurodivergent, apply ALL of these practices:
- Use clear, literal, concrete language. Avoid idioms, sarcasm, rhetorical questions, and ambiguous phrasing (unless the lesson is explicitly about figurative language, in which case teach it directly and explicitly).
- Provide predictable, explicitly numbered structure. For every task state exactly what to do, in what order, and what "done" looks like.
- Break work into short, clearly labeled chunks. Prefer numbered steps and lists over long paragraphs.
- Make abstract ideas concrete: give a worked, step-by-step example before asking the student to generalize.
- In any teacher-facing guidance, include a short "Support Strategies" list: sensory and pacing supports (movement breaks, advance warning before transitions, quiet work options) and how to present the material to this specific student.`;
  }
  if (interests) {
    text += `
Student Special Interests: ${interests}
Actively weave these interests into examples, reading hooks, word problems, question scenarios, and homework. Interest-based framing is the single strongest engagement tool for this student — use it in every section where it fits naturally without distorting the content.`;
  }
  return text;
}

async function startServer() {
  const app = express();
  // Note: PORT=0 is meaningful (OS-assigned port), so don't use `|| 3000`,
  // which would treat 0 as unset.
  const PORT = process.env.PORT !== undefined && process.env.PORT !== '' && !isNaN(Number(process.env.PORT))
    ? Number(process.env.PORT)
    : 3000;

  app.use(express.json());

  // Resolve the Gemini key for a request: a key saved by the user in the app's
  // Settings tab arrives as an X-Gemini-Key header and wins; otherwise fall
  // back to the server's .env/.env.local key. The packaged desktop app has no
  // .env, so the header is the only source there.
  function resolveApiKey(req: express.Request): string {
    return String(req.header('x-gemini-key') || process.env.GEMINI_API_KEY || '').trim();
  }

  // The model used when the user has not picked one in Settings. Every route
  // resolves per-request from the X-Gemini-Model header so a parent can switch
  // models (e.g. off one that is throttled) without a rebuild.
  const DEFAULT_MODEL = 'gemini-2.5-flash';

  // Only accept plausible model ids from the header — it is echoed into the
  // request path, so reject anything that isn't a bare model name.
  function resolveModel(req: express.Request): string {
    const requested = String(req.header('x-gemini-model') || '').trim();
    return /^[a-z0-9.\-]+$/i.test(requested) ? requested : DEFAULT_MODEL;
  }

  // The SDK throws with Google's raw error JSON as the message. Parents should
  // never see that, and the common failures all have the same fix — change the
  // model in Settings — so say that instead of echoing a bare status code.
  function sendAiError(req: express.Request, res: express.Response, error: any, fallback: string) {
    const raw: string = error?.message || '';
    const embedded = raw.match(/"message"\s*:\s*"([^"]+)"/);
    const detail = embedded ? embedded[1] : raw;
    const model = resolveModel(req);
    const status: number = error?.status || 0;

    let message: string;
    if (status === 404 || /is not found for API version|not supported for generateContent/i.test(detail)) {
      message = `The AI model "${model}" isn’t available to your API key. Open Settings → AI Model and pick a different model from the list.`;
    } else if (status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(detail)) {
      message = `You’ve hit the free-tier limit for "${model}". Wait a minute and try again, or switch to another model in Settings → AI Model.`;
    } else if (status === 503 || /high demand|UNAVAILABLE|overloaded/i.test(detail)) {
      message = `The AI model "${model}" is busy right now. Try again in a moment, or switch to another model in Settings → AI Model.`;
    } else {
      message = detail || fallback;
    }
    res.status(500).json({ error: message });
  }

  function getAI(req: express.Request) {
    const apiKey = resolveApiKey(req);
    if (!apiKey) {
      throw Object.assign(
        new Error('No Gemini API key configured. Open the Settings tab, paste your free Google AI Studio API key, and try again.'),
        { status: 500 }
      );
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  }

  // Lets the Settings tab show where the key is coming from (also used by the
  // desktop shell as a "server is up" health check).
  app.get("/api/key-status", (req, res) => {
    res.json({ hasEnvKey: !!process.env.GEMINI_API_KEY, hasHeaderKey: !!req.header('x-gemini-key') });
  });

  // Model ids Google lists as generateContent-capable but that cannot drive this
  // app: every route asks for JSON via responseSchema, which the media, speech,
  // robotics and agentic models either ignore or reject.
  const UNSUPPORTED_MODEL = /tts|image|audio|omni|lyria|nano-banana|robotics|computer-use|deep-research|antigravity|embedding/i;

  // The model picker in Settings asks Google what this key can actually use,
  // rather than trusting a list hardcoded at build time.
  app.get("/api/models", async (req, res) => {
    try {
      const key = resolveApiKey(req);
      if (!key) return res.status(400).json({ error: 'No Gemini API key configured.' });

      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
        headers: { 'x-goog-api-key': key }
      });
      const data: any = await r.json();
      if (!r.ok) {
        return res.status(r.status).json({ error: data?.error?.message || 'Could not load the model list from Google.' });
      }

      const models = (data.models || [])
        .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m: any) => ({
          id: String(m.name || '').replace(/^models\//, ''),
          label: m.displayName || String(m.name || '').replace(/^models\//, '')
        }))
        .filter((m: any) => m.id.startsWith('gemini-') && !UNSUPPORTED_MODEL.test(m.id))
        .sort((a: any, b: any) => a.id.localeCompare(b.id));

      res.json({ models, defaultModel: DEFAULT_MODEL });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Could not load the model list.' });
    }
  });

  // Verifies a pasted key with a minimal real model call before the user saves it.
  app.post("/api/validate-key", async (req, res) => {
    try {
      const key = String(req.body?.key || '').trim();
      if (!key) {
        return res.status(400).json({ ok: false, error: "No key provided." });
      }
      const ai = new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
      await ai.models.generateContent({ model: resolveModel(req), contents: "Reply with the single word OK." });
      res.json({ ok: true });
    } catch (error: any) {
      // Do not log the key. The SDK throws with Google's raw JSON error as the
      // message — pull out the human-readable part before showing it to a parent.
      let message: string = error?.message || 'The key was rejected by Google.';
      const embedded = message.match(/"message"\s*:\s*"([^"]+)"/);
      if (embedded) message = embedded[1];
      if (/API key not valid/i.test(message)) {
        message = 'Google rejected this key. Make sure you copied the entire key from AI Studio (it starts with AIza).';
      }
      res.status(400).json({ ok: false, error: message });
    }
  });

  // API Route
  app.post("/api/generate", async (req, res) => {
    try {
      const { subject, topic, gradeLevel, learningNeeds, interests, recentHistory } = req.body;

      if (!subject || !topic || !gradeLevel) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const ai = getAI(req);

      const needsText = buildStudentContext(learningNeeds, interests);
      const historyText = recentHistory ? `
Recent learning history for this student (most recent first):
${recentHistory}
Use this history to pitch difficulty correctly: if recent scores were low, add more scaffolding and review; if high, increase challenge. Connect the new material to previously covered topics where natural, and do not repeat questions the student has already seen.` : '';

      const response = await ai.models.generateContent({
        model: resolveModel(req),
        contents: `Generate comprehensive, grade-appropriate educational materials based on the following:
Subject: ${subject}
Topic: ${topic}
Grade Level: ${gradeLevel} (ranging from Grade 3 to Grade 12)${needsText}${historyText}

You are an expert curriculum designer and educational strategist. The reading material and worksheet complexity must be adapted to the Grade Level. A 3rd-grade text must use simple vocabulary and short sentences; a 12th-grade text must be rigorous and academic.
The worksheet questions and homework must be directly answerable using the reading material. 
The teacher guide must be direct and actionable.
For short_answer or essay question types, leave options array empty.
Additionally, provide a readability score (e.g. Lexile, Flesch-Kincaid) and feedback on the complexity of the reading material relative to the grade level.
Generate a short 3-question formative assessment quiz automatically alongside the generated lesson material for teachers to verify student understanding.
Automatically extract key vocabulary words from the generated lesson and provide a simple glossary section with definitions.
Suggest relevant external educational resources, such as specific YouTube channels, interactive websites, or library book recommendations, based on the generated topic.
`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              teacher_guide: {
                type: Type.STRING,
                description: "Instructions for the teacher on how to introduce and teach the concept. Include a lesson hook, pacing suggestions, and potential student stumbling blocks."
              },
              lesson_plan: {
                type: Type.STRING,
                description: "A structured, step-by-step outline of the lesson."
              },
              reading_material: {
                type: Type.STRING,
                description: "A comprehensive text written strictly at the specified grade's reading and cognitive level that explains the topic."
              },
              readability_score: {
                type: Type.STRING,
                description: "A readability score (e.g. Flesch-Kincaid, Lexile) evaluating the generated reading material."
              },
              readability_feedback: {
                type: Type.STRING,
                description: "Feedback on the complexity of the text relative to the chosen grade level."
              },
              glossary: {
                type: Type.ARRAY,
                description: "Key vocabulary words extracted from the lesson and their definitions.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING, description: "The vocabulary word." },
                    definition: { type: Type.STRING, description: "The definition of the word." }
                  },
                  required: ["word", "definition"]
                }
              },
              worksheet: {
                type: Type.ARRAY,
                description: "A list of questions based on the reading material.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING, description: "The text of the question" },
                    type: { type: Type.STRING, description: "multiple_choice | short_answer | essay" },
                    options: { 
                      type: Type.ARRAY, 
                      items: { type: Type.STRING },
                      description: "Option texts, leave empty if type is not multiple_choice." 
                    },
                    answer: { type: Type.STRING, description: "The correct answer or a grading rubric for an essay." }
                  },
                  required: ["question", "type", "options", "answer"]
                }
              },
              formative_assessment: {
                type: Type.ARRAY,
                description: "A short 3-question formative assessment quiz to verify student understanding.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING, description: "The text of the question" },
                    type: { type: Type.STRING, description: "multiple_choice | short_answer" },
                    options: { 
                      type: Type.ARRAY, 
                      items: { type: Type.STRING },
                      description: "Option texts, leave empty if type is not multiple_choice." 
                    },
                    answer: { type: Type.STRING, description: "The correct answer." }
                  },
                  required: ["question", "type", "options", "answer"]
                }
              },
              homework: {
                type: Type.STRING,
                description: "A brief assignment for the student to complete independently that reinforces the lesson."
              },
              resources: {
                type: Type.ARRAY,
                description: "Relevant external educational resources based on the generated topic.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Title of the resource." },
                    url: { type: Type.STRING, description: "URL to the resource, if applicable." },
                    description: { type: Type.STRING, description: "A brief description of why this resource is useful." },
                    type: { type: Type.STRING, description: "The type of resource, e.g., YouTube Video, Website, Book." }
                  },
                  required: ["title", "description", "type"]
                }
              }
            },
            required: ["teacher_guide", "lesson_plan", "reading_material", "readability_score", "readability_feedback", "glossary", "worksheet", "formative_assessment", "homework", "resources"]
          }
        }
      });

      const jsonStr = response.text;
      const data = JSON.parse(jsonStr || "{}");
      res.json(data);
      
    } catch (error: any) {
      console.error("API error:", error);
      sendAiError(req, res, error, "Failed to generate curriculum");
    }
  });

  // API Route for Grade Assessment
  app.post("/api/assess-grade", async (req, res) => {
    try {
      const { studentData, subject, learningNeeds, interests } = req.body;

      if (!studentData) {
        return res.status(400).json({ error: "Missing student data" });
      }

      const ai = getAI(req);

      const needsText = learningNeeds || interests ? `${buildStudentContext(learningNeeds, interests)}
Use this context to inform your assessment (distinguish support needs from ability level — do not underestimate the grade level because of neurodivergent traits) and tailor the recommended focus areas to be effective for a student with these traits.` : '';

      const response = await ai.models.generateContent({
        model: resolveModel(req),
        contents: `Analyze the following student data (such as a writing sample, math problem-solving description, or general abilities) to determine their approximate grade level (between Grade 3 and Grade 12) for the subject: ${subject || 'General'}.
${needsText}
Student Data:
${studentData}

You are an expert educational assessor. Provide the suggested grade level, a detailed rationale based on cognitive markers, vocabulary, and subject-specific skills, and 3 recommended focus areas to help the student progress.
`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggested_grade: {
                type: Type.STRING,
                description: "The suggested grade level, e.g., 'Grade 5'."
              },
              rationale: {
                type: Type.STRING,
                description: "Detailed explanation of why this grade level was chosen based on the provided student data."
              },
              focus_areas: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of 3 actionable focus areas or skills the student should work on next."
              }
            },
            required: ["suggested_grade", "rationale", "focus_areas"]
          }
        }
      });

      const jsonStr = response.text;
      const data = JSON.parse(jsonStr || "{}");
      res.json(data);
      
    } catch (error: any) {
      console.error("API error:", error);
      sendAiError(req, res, error, "Failed to assess grade level");
    }
  });

  // API Route for Gap Analysis
  app.post("/api/analyze-gaps", async (req, res) => {
    try {
      const { subject, gradeLevel, coveredTopics, completedLessons, learningNeeds, interests } = req.body;

      if (!subject || !gradeLevel) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const ai = getAI(req);

      const needsText = learningNeeds || interests ? `${buildStudentContext(learningNeeds, interests)}
Factor these into your remediation ideas, suggesting methods that suit their specific learning profile.` : '';

      const historyText = completedLessons ? `\nLessons the student has completed in this app (from their tracked history): ${completedLessons}` : '';

      const response = await ai.models.generateContent({
        model: resolveModel(req),
        contents: `You are an expert curriculum designer and educational consultant for homeschooling parents.
Generate a comprehensive knowledge gap analysis for a student in Grade ${gradeLevel} studying ${subject}.
${coveredTopics ? `The parent reports they have already covered: ${coveredTopics}` : ''}${historyText}${needsText}

Identify the core concepts standard for this grade and subject. Then, identify common knowledge gaps that homeschooling parents might inadvertently miss. 
Provide a diagnostic checklist of questions the parent can ask the student to verify understanding of each core concept.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              core_concepts: {
                type: Type.ARRAY,
                description: "List of core concepts the student should master.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    concept: { type: Type.STRING, description: "Name of the core concept" },
                    description: { type: Type.STRING, description: "Brief description of the concept" },
                    verification_question: { type: Type.STRING, description: "A diagnostic question the parent can ask the student to verify understanding." }
                  },
                  required: ["concept", "description", "verification_question"]
                }
              },
              common_gaps: {
                type: Type.ARRAY,
                description: "List of commonly missed topics or skills.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    gap: { type: Type.STRING, description: "The commonly missed topic or skill." },
                    reason: { type: Type.STRING, description: "Why this is often missed in alternative education/homeschooling." },
                    remediation_idea: { type: Type.STRING, description: "A practical idea for how to teach or review this topic quickly." }
                  },
                  required: ["gap", "reason", "remediation_idea"]
                }
              }
            },
            required: ["core_concepts", "common_gaps"]
          }
        }
      });

      const jsonStr = response.text;
      const data = JSON.parse(jsonStr || "{}");
      res.json(data);
      
    } catch (error: any) {
      console.error("API error:", error);
      sendAiError(req, res, error, "Failed to analyze knowledge gaps");
    }
  });

  // API Route for Quarter Curriculum Planner
  app.post("/api/quarter-planner", async (req, res) => {
    try {
      const { studentName, gradeLevel, learningNeeds, interests, quarterNumber, previousQuarters, schedulingNotes } = req.body;

      if (!studentName || !gradeLevel) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const ai = getAI(req);

      const needsText = learningNeeds || interests ? `${buildStudentContext(learningNeeds, interests)}
Tailor the curriculum pace, topics, and schedule to these needs. If the student benefits from routine and predictability, make the daily schedule template a consistent, explicit visual routine (same order every day, clear start/end cues, built-in breaks).` : '';

      const qNum = Number(quarterNumber) >= 1 && Number(quarterNumber) <= 4 ? Number(quarterNumber) : 1;
      const progressionText = previousQuarters ? `
This school year is planned quarter by quarter. Earlier quarters covered the following topics:
${previousQuarters}
Design Quarter ${qNum} as a direct continuation: build on what was already taught, do not repeat covered topics (brief review weeks are fine where pedagogically standard), and keep each subject progressing along a coherent full-year scope and sequence toward end-of-year mastery for ${gradeLevel}.` : `
This is Quarter ${qNum} of a four-quarter school year. Choose topics that form the natural Quarter ${qNum} portion of a full-year scope and sequence for ${gradeLevel}, leaving logical room for the remaining quarters.`;

      const scheduleText = schedulingNotes ? `
Teacher scheduling notes and constraints — you MUST honor these directly in the daily schedule template and overall pacing: ${schedulingNotes}` : '';

      const response = await ai.models.generateContent({
        model: resolveModel(req),
        contents: `You are an expert curriculum designer and educational consultant.
Generate the Quarter ${qNum} curriculum (9 weeks) for a homeschooling student named ${studentName} in ${gradeLevel}.${needsText}${progressionText}${scheduleText}
The curriculum should include a comprehensive teacher's guide to keep the student on schedule and ensure they have all the knowledge needed to pass the quarter. Include core subjects like Math, Science, Language Arts, and Social Studies.
For each subject, provide an overview and a week-by-week plan outlining the topic, learning objective, and a quick assessment check to verify mastery. Finally, provide a daily schedule template that reflects any scheduling notes above (specific weekdays, appointments, co-op days, preferred start times, and break needs).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              student_name: { type: Type.STRING },
              grade_level: { type: Type.STRING },
              teacher_guide: { type: Type.STRING, description: "Detailed advice for the parent/teacher on keeping schedule and ensuring knowledge mastery." },
              daily_schedule_template: { type: Type.STRING, description: "A suggested daily schedule." },
              subjects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    subject: { type: Type.STRING },
                    overview: { type: Type.STRING },
                    weekly_plan: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          week: { type: Type.INTEGER },
                          topic: { type: Type.STRING },
                          learning_objective: { type: Type.STRING },
                          assessment_check: { type: Type.STRING }
                        },
                        required: ["week", "topic", "learning_objective", "assessment_check"]
                      }
                    }
                  },
                  required: ["subject", "overview", "weekly_plan"]
                }
              }
            },
            required: ["student_name", "grade_level", "teacher_guide", "daily_schedule_template", "subjects"]
          }
        }
      });

      const jsonStr = response.text;
      const data = JSON.parse(jsonStr || "{}");
      res.json(data);
      
    } catch (error: any) {
      console.error("API error:", error);
      sendAiError(req, res, error, "Failed to generate quarter curriculum");
    }
  });

  // API Route to regenerate a single section of an existing lesson
  app.post("/api/regenerate-section", async (req, res) => {
    try {
      const { section, instruction, subject, topic, gradeLevel, learningNeeds, interests, readingMaterial, currentQuestions } = req.body;

      const questionItemSchema = {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: "The text of the question" },
          type: { type: Type.STRING, description: "multiple_choice | short_answer | essay" },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Option texts, leave empty if type is not multiple_choice."
          },
          answer: { type: Type.STRING, description: "The correct answer or a grading rubric for an essay." }
        },
        required: ["question", "type", "options", "answer"]
      };

      const sections: Record<string, { schema: any; task: string }> = {
        reading_material: {
          schema: {
            type: Type.OBJECT,
            properties: {
              reading_material: { type: Type.STRING, description: "The rewritten reading material." },
              readability_score: { type: Type.STRING, description: "A readability score (e.g. Flesch-Kincaid, Lexile) for the rewritten text." },
              readability_feedback: { type: Type.STRING, description: "Feedback on the complexity of the rewritten text relative to the grade level." }
            },
            required: ["reading_material", "readability_score", "readability_feedback"]
          },
          task: "Rewrite the lesson's reading material. Cover the same concepts so existing worksheet questions remain answerable from the new text."
        },
        worksheet: {
          schema: {
            type: Type.OBJECT,
            properties: {
              worksheet: { type: Type.ARRAY, description: "The new worksheet questions.", items: questionItemSchema }
            },
            required: ["worksheet"]
          },
          task: "Generate a NEW set of worksheet questions answerable directly from the reading material provided below. Do not reuse the current questions."
        },
        formative_assessment: {
          schema: {
            type: Type.OBJECT,
            properties: {
              formative_assessment: { type: Type.ARRAY, description: "A new 3-question formative assessment quiz.", items: questionItemSchema }
            },
            required: ["formative_assessment"]
          },
          task: "Generate a NEW 3-question formative assessment quiz answerable from the reading material provided below. Do not reuse the current questions."
        }
      };

      const target = sections[section];
      if (!target || !instruction || !subject || !topic || !gradeLevel) {
        return res.status(400).json({ error: "Missing or invalid fields" });
      }

      const ai = getAI(req);

      const response = await ai.models.generateContent({
        model: resolveModel(req),
        contents: `You are an expert curriculum designer regenerating one section of an existing lesson.
Subject: ${subject}
Topic: ${topic}
Grade Level: ${gradeLevel}${buildStudentContext(learningNeeds, interests)}

TASK: ${target.task}
ADJUSTMENT REQUESTED BY THE TEACHER: ${instruction}
${readingMaterial ? `\nCurrent reading material:\n${readingMaterial}` : ''}${currentQuestions ? `\nCurrent questions (do not repeat these):\n${currentQuestions}` : ''}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: target.schema
        }
      });

      const jsonStr = response.text;
      const data = JSON.parse(jsonStr || "{}");
      res.json(data);

    } catch (error: any) {
      console.error("API error:", error);
      sendAiError(req, res, error, "Failed to regenerate section");
    }
  });

  // Feature 5 — Standardized Testing Prep. Generates an exam-style practice set.
  app.post("/api/test-prep", async (req, res) => {
    try {
      const { examType, section, gradeLevel, learningNeeds, interests, focusSkills, count } = req.body;
      if (!examType || !section || !gradeLevel) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const ai = getAI(req);
      const needsText = buildStudentContext(learningNeeds, interests);
      const n = Math.min(Math.max(Number(count) || 8, 3), 15);
      const focusText = focusSkills ? `\nPrioritize questions that target these specific skills or knowledge gaps: ${focusSkills}.` : '';

      const questionItem = {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: "The full question text, including any passage or setup needed to answer it." },
          type: { type: Type.STRING, description: "multiple_choice | short_answer" },
          options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Answer choices; empty for short_answer." },
          answer: { type: Type.STRING, description: "The correct answer." },
          explanation: { type: Type.STRING, description: "A clear worked explanation of why the answer is correct, teaching the underlying skill." },
          skill: { type: Type.STRING, description: "The specific skill or content domain this question assesses." }
        },
        required: ["question", "type", "options", "answer", "explanation", "skill"]
      };

      const response = await ai.models.generateContent({
        model: resolveModel(req),
        contents: `You are an expert standardized-test tutor. Create a realistic ${examType} practice set for the "${section}" section, calibrated for a student at ${gradeLevel}.${needsText}${focusText}
Generate exactly ${n} questions that mirror the real ${examType} format, difficulty, and question styles for ${section}. Include a mix of difficulties. Each question must be fully self-contained (include any reading passage or data needed). Provide a teaching explanation for every question.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { questions: { type: Type.ARRAY, items: questionItem } },
            required: ["questions"]
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("API error (test-prep):", error);
      sendAiError(req, res, error, "Failed to generate test prep");
    }
  });

  // Feature 10 — Reading Level Analyzer. Analyzes pasted text and suggests next reads.
  app.post("/api/reading-level", async (req, res) => {
    try {
      const { text, targetGrade, interests } = req.body;
      if (!text || String(text).trim().length < 20) {
        return res.status(400).json({ error: "Please provide a longer text sample (at least a few sentences)." });
      }
      const ai = getAI(req);
      const interestText = interests ? `\nThe reader's interests are: ${interests}. Bias the recommended texts toward these interests where possible.` : '';
      const targetText = targetGrade ? `\nThe reader's current working grade level is around ${targetGrade}; frame suggestions relative to that.` : '';

      const response = await ai.models.generateContent({
        model: resolveModel(req),
        contents: `You are a reading specialist. Analyze the reading difficulty of the TEXT below.${targetText}${interestText}
Estimate its reading level with a grade band, an approximate Lexile measure, and an approximate Flesch-Kincaid grade. Explain what makes it easy or hard (sentence length, vocabulary, syntax, abstraction). List concrete strengths of the writing (if it is student work) and specific suggestions to grow the reader. Recommend 4-6 real books/texts at an appropriately challenging level.

TEXT:
"""${String(text).slice(0, 6000)}"""`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              gradeLevel: { type: Type.STRING, description: "Estimated grade band, e.g. 'Grade 6-7'." },
              lexile: { type: Type.STRING, description: "Approximate Lexile measure, e.g. '850L'." },
              fleschKincaid: { type: Type.STRING, description: "Approximate Flesch-Kincaid grade level, e.g. '7.2'." },
              analysis: { type: Type.STRING, description: "Explanation of the factors driving the reading level." },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Strengths of the text/writing." },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Actionable ways to grow the reader." },
              recommendedTexts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    author: { type: Type.STRING },
                    why: { type: Type.STRING, description: "Why this text suits the reader now." }
                  },
                  required: ["title", "why"]
                }
              }
            },
            required: ["gradeLevel", "lexile", "fleschKincaid", "analysis", "strengths", "suggestions", "recommendedTexts"]
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("API error (reading-level):", error);
      sendAiError(req, res, error, "Failed to analyze reading level");
    }
  });

  // Feature 9 — Math & Science step-by-step solver with worked answer key.
  app.post("/api/solve-problem", async (req, res) => {
    try {
      const { problem, subject, gradeLevel, learningNeeds } = req.body;
      if (!problem) {
        return res.status(400).json({ error: "Missing problem" });
      }
      const ai = getAI(req);
      const needsText = buildStudentContext(learningNeeds, undefined);

      const response = await ai.models.generateContent({
        model: resolveModel(req),
        contents: `You are an expert ${subject || 'math and science'} teacher creating a worked answer key for a homeschooling parent who may not remember the material.
Solve the following problem for a student at ${gradeLevel || 'the appropriate grade level'}, showing every step of the work with clear reasoning a parent can teach from.${needsText}

PROBLEM:
${problem}

Restate the problem, then show numbered steps (each with the actual math/work AND a plain-language explanation of why). Give the final answer clearly, a way to check it, common mistakes students make, and 2-3 similar practice problems with answers.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              problem_restated: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Short label for the step." },
                    work: { type: Type.STRING, description: "The actual math/work performed in this step." },
                    explanation: { type: Type.STRING, description: "Plain-language reason for this step." }
                  },
                  required: ["title", "work", "explanation"]
                }
              },
              final_answer: { type: Type.STRING },
              check: { type: Type.STRING, description: "How to verify the answer is correct." },
              common_mistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
              similar_practice: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { problem: { type: Type.STRING }, answer: { type: Type.STRING } },
                  required: ["problem", "answer"]
                }
              }
            },
            required: ["problem_restated", "steps", "final_answer", "check", "common_mistakes", "similar_practice"]
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("API error (solve-problem):", error);
      sendAiError(req, res, error, "Failed to solve problem");
    }
  });

  // Feature 8 — Custom Standards Alignment. Produces the standards list for a
  // framework/subject/grade so mastery can be tracked against it.
  app.post("/api/standards", async (req, res) => {
    try {
      const { framework, subject, gradeLevel, coveredTopics } = req.body;
      if (!framework || !subject || !gradeLevel) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const ai = getAI(req);
      const coveredText = coveredTopics ? `\nThe parent reports the student has already covered: ${coveredTopics}. Still list all standards, but this context may help you phrase descriptions.` : '';

      const response = await ai.models.generateContent({
        model: resolveModel(req),
        contents: `You are a curriculum standards expert. List the key learning standards for ${subject} at ${gradeLevel} under the "${framework}" framework.${coveredText}
Provide the standard code exactly as that framework writes it (or a clearly-formatted equivalent if the framework does not use codes), the subject strand, and a parent-friendly one-sentence description of what the student should be able to do. Focus on the 10-18 most important standards for the year.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              standards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    code: { type: Type.STRING, description: "Standard code, e.g. 'CCSS.MATH.7.RP.A.1'." },
                    subject: { type: Type.STRING, description: "Subject strand, e.g. 'Ratios & Proportional Relationships'." },
                    description: { type: Type.STRING, description: "Parent-friendly description of the standard." }
                  },
                  required: ["code", "subject", "description"]
                }
              }
            },
            required: ["standards"]
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("API error (standards):", error);
      sendAiError(req, res, error, "Failed to generate standards");
    }
  });

  // Feature 1 — Parent-friendly progress narrative for the report card.
  app.post("/api/progress-summary", async (req, res) => {
    try {
      const { studentName, gradeLevel, stats, learningNeeds, period } = req.body;
      if (!studentName || !stats) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const ai = getAI(req);
      const needsText = learningNeeds ? `\nThe student's learning profile: ${learningNeeds}. Write with strengths-based, respectful language.` : '';

      const response = await ai.models.generateContent({
        model: resolveModel(req),
        contents: `You are an encouraging but honest homeschool educator writing a progress summary a parent can share with a co-parent, co-op, or for compliance records.
Student: ${studentName} (${gradeLevel || 'unspecified grade'}). Reporting period: ${period || 'recent'}.${needsText}
Here is the underlying data (JSON): ${JSON.stringify(stats).slice(0, 4000)}

Write a warm, professional 2-3 paragraph narrative summary of progress grounded ONLY in this data (do not invent scores). Then list concrete highlights and recommended focus areas for next.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: "2-3 paragraph narrative." },
              highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
              focus_next: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["summary", "highlights", "focus_next"]
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("API error (progress-summary):", error);
      sendAiError(req, res, error, "Failed to generate summary");
    }
  });

  // Vite middleware for development. Vite is ESM-only and dev-only, so it is
  // imported lazily here — the production server bundle is built with
  // NODE_ENV defined to "production", which dead-code-eliminates this whole
  // branch (a top-level `require("vite")` crashes inside the packaged
  // desktop app).
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // The production bundle (dist/server.cjs) sits inside the dist folder
    // itself, so __dirname is the right root there (the packaged desktop app's
    // working directory is NOT the install folder). Fall back to cwd/dist for
    // a plain `node dist/server.cjs` run from the project root.
    const distPath = typeof __dirname !== 'undefined' ? __dirname : path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // PORT=0 asks the OS for any free port (used by the desktop app so Windows
  // excluded-port ranges can never block startup). Resolve with the actual
  // port once listening so the caller knows where to connect.
  return await new Promise<number>((resolve, reject) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : PORT;
      console.log(`Server running on port ${actualPort}`);
      resolve(actualPort);
    });
    server.on('error', reject);
  });
}

// The desktop shell (electron-main) awaits this to learn the chosen port;
// running standalone (npm run dev / npm start) it just starts the server.
export const ready: Promise<number> = startServer();
ready.catch(err => {
  console.error('Server failed to start:', err);
});
