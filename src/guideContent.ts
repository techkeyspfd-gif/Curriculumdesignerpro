// Instructional content for the Guide tab and the contextual HelpCallouts.
// Keeping it in one place means the in-app help and the printable Guide never
// drift apart.

export interface GuideSection {
  id: string;
  title: string;
  icon: string;      // lucide icon name (resolved in Guide.tsx)
  tagline: string;
  what: string;
  steps: string[];
  tips?: string[];
}

// The quick-start a brand-new parent should read first.
export const GETTING_STARTED: string[] = [
  'One-time setup: open Settings (in the Setup group) and paste your free Google Gemini API key — every AI feature needs it. If lessons already generate fine, you can skip this.',
  'Open the Students tab and add a profile for each child. Fill in grade level, and — importantly — their learning needs and special interests. Everything the app generates is tailored to what you enter here.',
  'Pick a student using the profile chip (their name and color follow you across every tab).',
  'Go to Year Planner and generate a full-year, quarter-by-quarter plan for that student. This becomes the backbone the rest of the app schedules against.',
  'Each day, open Today to see the next lesson for each child. Click Generate Lesson to create the full teaching materials (reading, worksheet, quiz, glossary, homework).',
  'Teach the lesson, then record scores and mark it complete. Completed work automatically flows into Reports, the Portfolio, and Standards mastery.',
  'Log your instructional time and attendance daily, and add activities and work samples as they happen. At any point you can export polished PDFs for your records or co-op.',
];

// Short, per-feature instructions. `steps` are reused verbatim inside each
// feature tab's HelpCallout so guidance is identical everywhere.
export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'settings', title: 'Settings & API Key', icon: 'KeyRound',
    tagline: 'The one-time setup that turns the AI on.',
    what: 'All lesson generation, planning, and analysis runs on Google\'s Gemini AI, which requires a free API key. The desktop app needs you to paste your own key once; it is stored only on this computer.',
    steps: [
      'Get a free key at aistudio.google.com/apikey (sign in with any Google account and click “Create API key”).',
      'Open Settings and paste the key into the API key box.',
      'Click “Test connection” to confirm it works, then click Save.',
    ],
    tips: ['If AI features suddenly stop working ("failed to fetch" or key errors), come back here and test your key — this is almost always the fix.'],
  },
  {
    id: 'students', title: 'Students', icon: 'Users',
    tagline: 'Set up each child once — every tool reads from here.',
    what: 'Student profiles hold the grade level, learning needs, special interests, standards framework, and compliance targets that personalize everything the app makes.',
    steps: [
      'Click “Add Student” and enter their name and grade.',
      'Describe learning needs/traits (e.g. “autistic, needs literal language and clear steps”). This reshapes tone and structure across all generated material.',
      'Add special interests (e.g. “trains, Minecraft”). The app weaves these into examples and reading hooks.',
      'Optionally set the standards framework and your state’s required days/hours for compliance.',
    ],
    tips: ['Keep learning needs specific — concrete traits produce far better accommodations than vague ones.'],
  },
  {
    id: 'today', title: 'Today (Dashboard)', icon: 'LayoutDashboard',
    tagline: 'Your daily starting point.',
    what: 'Shows the next unfinished item from each student’s year plan, plus upcoming due dates and recent activity, so you always know what to teach next.',
    steps: [
      'Read the “Next Up” card for each child.',
      'Click Generate Lesson to build materials, or Open Lesson if it already exists.',
      'Check the reminders strip for anything due soon.',
    ],
  },
  {
    id: 'curriculum', title: 'Lesson Designer', icon: 'BookOpen',
    tagline: 'Generate a complete, ready-to-teach lesson.',
    what: 'Produces a teacher guide, grade-leveled reading, worksheet, auto-graded-style quiz, glossary, homework, and resource links for any subject and topic.',
    steps: [
      'Enter a subject and topic and set the grade slider.',
      'Click Generate Curriculum and wait a few seconds.',
      'Teach from the Teacher Guide; print or export the student pages.',
      'Use “Regenerate” on a section to adjust difficulty or style.',
      'Record worksheet/quiz scores and mark complete when finished.',
    ],
    tips: ['Select a student first so the lesson adapts to their needs, interests, and recent scores.'],
  },
  {
    id: 'assessor', title: 'Grade Assessor', icon: 'UserCheck',
    tagline: 'Find the right level to teach at.',
    what: 'Analyzes a writing sample or description of your child’s abilities and suggests a grade level with rationale and focus areas.',
    steps: [
      'Paste a writing sample or describe what the student can do.',
      'Choose the subject and click Assess.',
      'Review the suggested grade and save it to the student’s history.',
    ],
  },
  {
    id: 'gaps', title: 'Gap Analyzer', icon: 'ShieldAlert',
    tagline: 'Catch what a homeschool year might miss.',
    what: 'Lists the core concepts for a grade/subject and the gaps parents commonly overlook, with quick diagnostic questions and remediation ideas.',
    steps: [
      'Pick a subject and grade and list what you’ve already covered.',
      'Click Analyze.',
      'Use the verification questions to spot-check understanding, then teach any gaps.',
    ],
  },
  {
    id: 'year', title: 'Year Planner', icon: 'CalendarDays',
    tagline: 'A full-year scope and sequence, quarter by quarter.',
    what: 'Generates a 9-week plan per quarter across core subjects, each quarter building on the last, with a daily schedule template that honors your constraints.',
    steps: [
      'Select a student and add any scheduling notes (co-op days, appointments).',
      'Generate Quarter 1, then generate later quarters — each continues the story.',
      'Click a week to jump to the Lesson Designer and build that week’s lesson.',
      'Weeks check off automatically as you complete their lessons.',
    ],
  },
  {
    id: 'calendar', title: 'Planner & Due Dates', icon: 'CalendarClock',
    tagline: 'See assignments on a calendar and never miss a due date.',
    what: 'A month calendar of lessons, assignments, and due dates with a reminders list. Due dates can auto-populate from your year plan.',
    steps: [
      'Add an assignment with a due date, or click “Fill from year plan” to schedule upcoming weeks.',
      'Watch the Upcoming/Overdue reminders at the top.',
      'Mark assignments done — completing a linked lesson checks them off automatically.',
    ],
  },
  {
    id: 'reports', title: 'Progress Reports', icon: 'BarChart3',
    tagline: 'Visual proof of growth you can share.',
    what: 'Charts mastery by subject, score trends over time, and standards progress, plus an AI-written parent-friendly narrative you can export.',
    steps: [
      'Select a student with completed lessons.',
      'Review the mastery, trend, and standards charts.',
      'Click “Generate summary” for a shareable written report, then Export PDF.',
    ],
  },
  {
    id: 'standards', title: 'Standards Alignment', icon: 'ListChecks',
    tagline: 'Track mastery against your state or framework.',
    what: 'Loads the key standards for a framework/subject/grade and lets you track each from “not started” to “mastered,” feeding the reports.',
    steps: [
      'Choose a framework on the student’s profile (e.g. Common Core, your state).',
      'Pick a subject and click “Load standards.”',
      'Update each standard’s mastery level as your child progresses.',
    ],
  },
  {
    id: 'testprep', title: 'Test Prep', icon: 'GraduationCap',
    tagline: 'Practice for the SAT, ACT, or state tests.',
    what: 'Generates realistic practice sets and diagnostics tied to a student’s gaps, with worked explanations and score tracking toward benchmarks.',
    steps: [
      'Choose the exam (SAT/ACT/State/Diagnostic) and section.',
      'Optionally list target skills, then Generate.',
      'Work the questions, reveal explanations, and record the score to track progress.',
    ],
  },
  {
    id: 'tools', title: 'Math & Science Tools', icon: 'Calculator',
    tagline: 'Step-by-step help so you can teach any problem.',
    what: 'A worked solver that shows every step and the reasoning, generates an answer key, flags common mistakes, and links quality STEM/OER resources.',
    steps: [
      'Type or paste a math/science problem and set the grade.',
      'Click Solve to get a step-by-step worked solution and answer key.',
      'Use the practice problems and printable tools with your student.',
    ],
  },
  {
    id: 'reading', title: 'Reading Level Analyzer', icon: 'BookOpenCheck',
    tagline: 'Measure reading level and find the next great book.',
    what: 'Paste any text (an article or your child’s own writing) to get grade level, Lexile, and Flesch-Kincaid estimates, plus book recommendations. Save results to track growth.',
    steps: [
      'Paste a text sample and click Analyze.',
      'Review the level metrics and the “what makes it hard” breakdown.',
      'Save the result to a student to chart reading growth over time.',
    ],
  },
  {
    id: 'worksamples', title: 'Work Samples', icon: 'Images',
    tagline: 'Build a digital portfolio of real work.',
    what: 'Upload photos or scans of your child’s work, tag them by subject/skill/standard/date, and compare growth side by side. Included in the exported portfolio.',
    steps: [
      'Click Upload and choose a photo or PDF of the work.',
      'Add a title, subject, date, and skill/standard tags.',
      'Filter by subject or skill, or pick two samples to compare growth.',
    ],
  },
  {
    id: 'timelog', title: 'Time Log', icon: 'Clock',
    tagline: 'Record instructional hours per subject.',
    what: 'Logs daily minutes by subject for one student and reports totals over any date range — the raw hours behind compliance and the portfolio.',
    steps: [
      'Pick the date and enter time per subject/activity.',
      'Save the log (one per day; saving updates it).',
      'Use the report and Export PDF for your records.',
    ],
  },
  {
    id: 'attendance', title: 'Attendance & Compliance', icon: 'CalendarCheck',
    tagline: 'Track days and hours against your state’s rules.',
    what: 'A one-click attendance calendar plus a compliance dashboard showing days and hours completed versus your state’s requirements, with an exportable report.',
    steps: [
      'Set your state’s required days/hours on the student’s profile.',
      'Mark each school day present/partial/absent/holiday on the calendar.',
      'Watch the progress meters and export the compliance report when needed.',
    ],
  },
  {
    id: 'activities', title: 'Activities & Extracurriculars', icon: 'Trophy',
    tagline: 'Document field trips, co-ops, sports, and service.',
    what: 'Logs outings and activities with hours and learning outcomes tied to subjects, so they count toward the education record.',
    steps: [
      'Click Add Activity and choose a category.',
      'Record the date, hours, and what was learned (and which subjects it connects to).',
      'Everything appears in the portfolio and can be exported.',
    ],
  },
  {
    id: 'collaborate', title: 'Family Notes & Co-Teaching', icon: 'MessagesSquare',
    tagline: 'Keep every guardian on the same page.',
    what: 'A shared observation log per student — wins, concerns, and milestones — plus an activity timeline. Share with a co-parent by exporting a backup they can import.',
    steps: [
      'Add an observation with your name and a category (Win, Concern, Milestone…).',
      'Review the shared timeline of notes and completed work.',
      'To sync with a co-parent, use Backup/Export in Students and have them import it (or share a Google Drive backup).',
    ],
    tips: ['This app stores data on each device. Google Drive backup or the export file is how two guardians share one student’s records.'],
  },
];

// Look up a section's steps by id for use in a HelpCallout.
export function helpSteps(id: string): string[] {
  return GUIDE_SECTIONS.find(s => s.id === id)?.steps ?? [];
}
