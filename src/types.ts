export interface WorksheetQuestion {
  question: string;
  type: string;
  options: string[];
  answer: string;
}

export interface Curriculum {
  teacher_guide: string;
  lesson_plan: string;
  reading_material: string;
  readability_score: string;
  readability_feedback: string;
  glossary: { word: string; definition: string }[];
  worksheet: WorksheetQuestion[];
  formative_assessment: WorksheetQuestion[];
  homework: string;
  resources: { title: string; url?: string; description: string; type: string }[];
}

export type RegenSection = 'reading_material' | 'worksheet' | 'formative_assessment';

export interface Score {
  correct: number;
  total: number;
}

export interface LessonResults {
  completedDate?: string;
  worksheetScore?: Score;
  quizScore?: Score;
  notes?: string;
}

// Links a lesson back to the year-plan week it was generated from.
export interface PlanSource {
  yearPlanId: string;
  quarterIndex: number;
  subjectIndex: number;
  weekIndex: number;
}

export interface SavedLesson {
  id: string;
  date: string;
  subject: string;
  topic: string;
  gradeLevel: string;
  studentId?: string;
  studentName?: string;
  curriculum: Curriculum;
  results?: LessonResults;
  source?: PlanSource;
}

export interface AssessmentRecord {
  date: string;
  subject: string;
  topic: string;
  gradeLevel: string;
  assessment: GradeAssessment;
}

export interface TimeLogEntry {
  subject: string;   // e.g. "Math", "Field Trip: Aquarium", "Science Lab"
  minutes: number;
}

export interface DailyLog {
  id: string;
  studentId: string;
  date: string;      // local date key, 'YYYY-MM-DD'
  startTime?: string; // 'HH:MM'
  endTime?: string;   // 'HH:MM'
  entries: TimeLogEntry[];
  notes?: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  gradeLevel: string;
  learningNeeds?: string;
  interests?: string;
  schedulingNotes?: string;
  color?: string;
  assessmentHistory: AssessmentRecord[];
  standardsFramework?: string;        // Feature 8 — selected standards framework
  compliance?: ComplianceSettings;    // Feature 6 — per-student compliance targets
}

export interface GradeAssessment {
  suggested_grade: string;
  rationale: string;
  focus_areas: string[];
}

export interface CoreConcept {
  concept: string;
  description: string;
  verification_question: string;
}

export interface CommonGap {
  gap: string;
  reason: string;
  remediation_idea: string;
}

export interface GapAnalysis {
  core_concepts: CoreConcept[];
  common_gaps: CommonGap[];
}

export interface WeeklyPlan {
  week: number;
  topic: string;
  learning_objective: string;
  assessment_check: string;
  completed?: boolean;
}

export interface SubjectPlan {
  subject: string;
  overview: string;
  weekly_plan: WeeklyPlan[];
}

export interface QuarterlyCurriculum {
  student_name: string;
  grade_level: string;
  teacher_guide: string;
  daily_schedule_template: string;
  subjects: SubjectPlan[];
}

// A full school year for one student: up to four chained quarters,
// each generated with awareness of what the earlier quarters covered.
export interface YearPlan {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: string;
  createdDate: string;
  quarters: QuarterlyCurriculum[];
}

// ---------------------------------------------------------------------------
// Records & collaboration features (work samples, activities, attendance,
// assignments, observations, standards). All stored per-student in
// localStorage and included in the backup payload.
// ---------------------------------------------------------------------------

// Feature 3 — Portfolio & Work Samples. Files are stored as data URLs so the
// whole portfolio stays inside the offline-first localStorage/Drive backup.
export interface WorkSample {
  id: string;
  studentId: string;
  date: string;            // ISO — when the work was done
  title: string;
  subject: string;
  skill?: string;          // freeform skill/standard tag
  standardId?: string;     // optional link to a standard code
  notes?: string;
  fileName: string;
  fileType: string;        // MIME type
  dataUrl: string;         // base64 data URL of the image/PDF
}

// Feature 7 — Social / Extracurricular logging.
export type ActivityCategory =
  | 'Field Trip' | 'Co-op Class' | 'Sports' | 'Music' | 'Art'
  | 'Community Service' | 'Club' | 'Competition' | 'Other';

export interface Activity {
  id: string;
  studentId: string;
  date: string;            // 'YYYY-MM-DD'
  category: ActivityCategory;
  title: string;
  location?: string;
  hours?: number;
  relatedSubjects?: string[];
  learningOutcomes?: string;
  notes?: string;
}

// Feature 6 — Attendance. One mark per student per date.
export type AttendanceStatus = 'present' | 'partial' | 'absent' | 'holiday';

export interface AttendanceMark {
  id: string;
  studentId: string;
  date: string;            // 'YYYY-MM-DD'
  status: AttendanceStatus;
  note?: string;
}

// Feature 6 — per-student compliance target (varies by state).
export interface ComplianceSettings {
  state?: string;
  requiredDays?: number;    // instructional days required per year
  requiredHours?: number;   // instructional hours required per year
  schoolYearStart?: string; // 'YYYY-MM-DD'
  schoolYearEnd?: string;   // 'YYYY-MM-DD'
}

// Feature 2 — Assignments & due dates. Can be standalone or linked to a lesson.
export type AssignmentStatus = 'todo' | 'in_progress' | 'done';

export interface Assignment {
  id: string;
  studentId: string;
  title: string;
  subject?: string;
  dueDate: string;          // 'YYYY-MM-DD'
  status: AssignmentStatus;
  lessonId?: string;        // optional link to a SavedLesson
  source?: PlanSource;      // optional link to a year-plan week
  notes?: string;
  createdDate: string;
}

// Feature 4 — Parent Collaboration: shared observations / notes.
export interface Observation {
  id: string;
  studentId: string;
  date: string;             // ISO
  author: string;          // co-parent / teacher name
  category?: string;        // e.g. Behavior, Milestone, Concern, Win
  text: string;
}

// Feature 8 — Standards alignment. Selected framework lives on the student;
// per-standard mastery is tracked here.
export type MasteryLevel = 'not_started' | 'introduced' | 'developing' | 'proficient' | 'mastered';

export interface StandardMastery {
  id: string;
  studentId: string;
  framework: string;        // e.g. "Common Core", "Texas TEKS"
  code: string;             // standard code, e.g. "CCSS.MATH.7.RP.A.1"
  subject: string;
  description: string;
  level: MasteryLevel;
  updatedDate: string;
  evidenceLessonIds?: string[];
}

// Feature 5 — Standardized Testing Prep sets (AI generated, then attempted).
export interface TestQuestion {
  question: string;
  type: string;             // multiple_choice | short_answer
  options: string[];
  answer: string;
  explanation: string;
  skill: string;            // skill/domain this question targets
}

export interface TestPrepSet {
  id: string;
  studentId: string;
  createdDate: string;
  examType: string;         // SAT | ACT | State Assessment | Diagnostic
  section: string;          // e.g. Math, Reading, Science
  gradeLevel: string;
  questions: TestQuestion[];
  lastScore?: Score;        // most recent self-scored attempt
  attempts?: { date: string; score: Score }[];
}

// Feature 10 — Reading Level Analyzer results, saved to track growth.
export interface ReadingAnalysis {
  id: string;
  studentId?: string;
  date: string;
  label: string;            // what was analyzed, e.g. "Journal entry 3/4"
  sample: string;           // the analyzed text (truncated for storage)
  gradeLevel: string;       // estimated grade band
  lexile: string;
  fleschKincaid: string;
  analysis: string;
  strengths: string[];
  suggestions: string[];
  recommendedTexts: { title: string; author?: string; why: string }[];
}

