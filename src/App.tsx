import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles, Loader2, GraduationCap, AlertCircle, BookOpen, UserCheck, ShieldAlert, CalendarDays,
  Users, Clock, LayoutDashboard, CalendarClock, ListChecks, BarChart3, CalendarCheck, Trophy,
  Images, MessagesSquare, Calculator, BookOpenCheck, LifeBuoy, KeyRound
} from 'lucide-react';
import { Curriculum, SavedLesson, PlanSource, LessonResults, RegenSection } from './types';
import { CurriculumDisplay } from './components/CurriculumDisplay';
import { GradeAssessor } from './components/GradeAssessor';
import { GapAnalyzer } from './components/GapAnalyzer';
import { YearPlanner } from './components/YearPlanner';
import { StudentManager } from './components/StudentManager';
import { LessonLibrary } from './components/LessonLibrary';
import { TimeLog } from './components/TimeLog';
import { Dashboard } from './components/Dashboard';
import { Guide } from './components/Guide';
import { Reports } from './components/Reports';
import { PlannerCalendar } from './components/PlannerCalendar';
import { Standards } from './components/Standards';
import { TestPrep } from './components/TestPrep';
import { MathTools } from './components/MathTools';
import { ReadingAnalyzer } from './components/ReadingAnalyzer';
import { Attendance } from './components/Attendance';
import { Activities } from './components/Activities';
import { WorkSamples } from './components/WorkSamples';
import { Collaboration } from './components/Collaboration';
import { Settings } from './components/Settings';
import { HelpCallout } from './components/ui';
import { helpSteps } from './guideContent';
import { useStudents } from './StudentContext';
import { postJson } from './api';
import { getStudentColor, colorForStudentId } from './studentColors';

// Grouped navigation. Tab ids match the guide-content ids so the Guide's
// "Open X" links resolve directly to a tab.
const NAV_GROUPS = [
  {
    label: 'Teach', tabs: [
      { id: 'today', label: 'Today', icon: LayoutDashboard },
      { id: 'curriculum', label: 'Lesson Designer', icon: BookOpen },
      { id: 'tools', label: 'Math & Science', icon: Calculator },
      { id: 'reading', label: 'Reading Level', icon: BookOpenCheck },
      { id: 'testprep', label: 'Test Prep', icon: GraduationCap },
    ]
  },
  {
    label: 'Plan', tabs: [
      { id: 'year', label: 'Year Planner', icon: CalendarDays },
      { id: 'calendar', label: 'Planner & Due', icon: CalendarClock },
      { id: 'assessor', label: 'Grade Assessor', icon: UserCheck },
      { id: 'gaps', label: 'Gap Analyzer', icon: ShieldAlert },
      { id: 'standards', label: 'Standards', icon: ListChecks },
    ]
  },
  {
    label: 'Track', tabs: [
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'timelog', label: 'Time Log', icon: Clock },
      { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
      { id: 'activities', label: 'Activities', icon: Trophy },
      { id: 'worksamples', label: 'Work Samples', icon: Images },
      { id: 'collaborate', label: 'Family Notes', icon: MessagesSquare },
    ]
  },
  {
    label: 'Setup', tabs: [
      { id: 'students', label: 'Students', icon: Users },
      { id: 'settings', label: 'Settings', icon: KeyRound },
      { id: 'guide', label: 'Guide', icon: LifeBuoy },
    ]
  },
] as const;

type TabId = typeof NAV_GROUPS[number]['tabs'][number]['id'];

// Maps a free-text grade like "8th Grade" onto the 3-12 slider, or null if it has no number.
function gradeToSliderValue(grade: string): string | null {
  const parsed = parseInt(grade.replace(/\D/g, ''), 10);
  if (isNaN(parsed)) return null;
  return String(Math.min(12, Math.max(3, parsed)));
}

interface LessonMeta {
  id: string;
  subject: string;
  topic: string;
  gradeLevel: string;
}

export default function App() {
  const { selectedStudent, lessons, saveLesson, updateLesson } = useStudents();
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState('5');

  useEffect(() => {
    if (selectedStudent) {
      const sliderValue = gradeToSliderValue(selectedStudent.gradeLevel);
      if (sliderValue) setGradeLevel(sliderValue);
    }
  }, [selectedStudent]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [lessonMeta, setLessonMeta] = useState<LessonMeta | null>(null);

  const activeLesson = lessonMeta ? lessons.find(l => l.id === lessonMeta.id) ?? null : null;

  // Compact history of this student's recent lessons and scores, fed to the
  // model so new material connects to prior work and is pitched correctly.
  const buildRecentHistory = (): string | undefined => {
    if (!selectedStudent) return undefined;
    const entries = lessons
      .filter(l => l.studentId === selectedStudent.id)
      .slice(0, 8)
      .map(l => {
        let line = `- ${l.subject}: ${l.topic} (${l.gradeLevel})`;
        const r = l.results;
        if (r?.completedDate) {
          line += ' — completed';
          if (r.worksheetScore) line += `, worksheet score ${r.worksheetScore.correct}/${r.worksheetScore.total}`;
          if (r.quizScore) line += `, quiz score ${r.quizScore.correct}/${r.quizScore.total}`;
        }
        return line;
      });
    return entries.length ? entries.join('\n') : undefined;
  };

  const generateLesson = async (genSubject: string, genTopic: string, sliderGrade: string, source?: PlanSource) => {
    setIsLoading(true);
    setError(null);
    setCurriculum(null);
    setLessonMeta(null);

    try {
      const data = await postJson<Curriculum>('/api/generate', {
        subject: genSubject,
        topic: genTopic,
        gradeLevel: `Grade ${sliderGrade}`,
        learningNeeds: selectedStudent?.learningNeeds,
        interests: selectedStudent?.interests,
        recentHistory: buildRecentHistory()
      });

      const saved: SavedLesson = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        subject: genSubject,
        topic: genTopic,
        gradeLevel: `Grade ${sliderGrade}`,
        studentId: selectedStudent?.id,
        studentName: selectedStudent?.name,
        curriculum: data,
        source
      };
      saveLesson(saved);
      setLessonMeta({ id: saved.id, subject: genSubject, topic: genTopic, gradeLevel: saved.gradeLevel });
      setCurriculum(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !topic || !gradeLevel) return;
    await generateLesson(subject, topic, gradeLevel);
  };

  const handleLoadLesson = (lesson: SavedLesson) => {
    setError(null);
    setSubject(lesson.subject);
    setTopic(lesson.topic);
    const sliderValue = gradeToSliderValue(lesson.gradeLevel);
    if (sliderValue) setGradeLevel(sliderValue);
    setLessonMeta({ id: lesson.id, subject: lesson.subject, topic: lesson.topic, gradeLevel: lesson.gradeLevel });
    setCurriculum(lesson.curriculum);
  };

  // Called from a Year Planner week row: jump to the Lesson Designer and
  // generate that week's lesson, linked back to the plan.
  const handlePlanLessonRequest = (planSubject: string, planTopic: string, planGrade: string, source: PlanSource) => {
    const slider = gradeToSliderValue(planGrade) ?? gradeLevel;
    setSubject(planSubject);
    setTopic(planTopic);
    setGradeLevel(slider);
    setActiveTab('curriculum');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    generateLesson(planSubject, planTopic, slider, source);
  };

  const handleOpenLessonFromPlan = (lesson: SavedLesson) => {
    handleLoadLesson(lesson);
    setActiveTab('curriculum');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenLessonById = (lessonId: string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (lesson) handleOpenLessonFromPlan(lesson);
  };

  const handleRegenerateSection = async (section: RegenSection, instruction: string) => {
    if (!curriculum || !lessonMeta) return;
    const currentQuestions =
      section === 'worksheet' ? curriculum.worksheet.map(q => q.question).join('\n')
      : section === 'formative_assessment' ? curriculum.formative_assessment.map(q => q.question).join('\n')
      : undefined;

    const data = await postJson<Partial<Curriculum>>('/api/regenerate-section', {
      section,
      instruction,
      subject: lessonMeta.subject,
      topic: lessonMeta.topic,
      gradeLevel: lessonMeta.gradeLevel,
      learningNeeds: selectedStudent?.learningNeeds,
      interests: selectedStudent?.interests,
      readingMaterial: curriculum.reading_material,
      currentQuestions
    });

    const updated = { ...curriculum, ...data };
    setCurriculum(updated);
    updateLesson(lessonMeta.id, { curriculum: updated });
  };

  const handleSaveResults = (results: LessonResults) => {
    if (!lessonMeta) return;
    updateLesson(lessonMeta.id, { results });
  };

  const goToStudents = () => setActiveTab('students');

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="w-full max-w-4xl mx-auto px-6 py-12 md:py-16">

        {/* Header */}
        <div className="text-center mb-10 print:hidden relative">
          {selectedStudent && (
            <div className="absolute top-0 right-0 hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors" onClick={goToStudents}>
              <span className={`w-2.5 h-2.5 rounded-full ${getStudentColor(selectedStudent.color || colorForStudentId(selectedStudent.id).id).swatch}`} />
              <span>{selectedStudent.name} ({selectedStudent.gradeLevel})</span>
            </div>
          )}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="inline-flex items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 mb-6"
          >
            <GraduationCap className="w-10 h-10 text-indigo-600" />
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4"
          >
            Curriculum Pro
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-gray-500 max-w-2xl mx-auto"
          >
            Plan, teach, track, and document your homeschool — all in one place.
          </motion.p>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => setActiveTab('guide')}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            <LifeBuoy className="w-4 h-4" /> New here? Read the Guide
          </motion.button>
        </div>

        {/* Grouped Navigation */}
        <div className="mb-8 print:hidden flex flex-wrap justify-center gap-3">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="rounded-2xl border border-gray-200 bg-gray-100/60 p-1.5">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 pt-0.5 pb-1 text-center">{group.label}</div>
              <div className="flex flex-wrap justify-center gap-1">
                {group.tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-white/60'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {activeTab === 'today' && (
          <Dashboard
            onGenerateLesson={handlePlanLessonRequest}
            onOpenLesson={handleOpenLessonFromPlan}
            onGoToStudents={goToStudents}
            onGoToYearPlanner={() => setActiveTab('year')}
            isGeneratingLesson={isLoading}
          />
        )}

        {activeTab === 'curriculum' && (
          <>
            <div className="mb-6 print:hidden">
              <HelpCallout id="curriculum" steps={helpSteps('curriculum')} defaultOpen={false} />
            </div>
            {/* Input Form */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 print:hidden"
            >
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Subject</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Science"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Topic</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Photosynthesis"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                    <span>Grade Level: {gradeLevel}</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="12"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 font-medium px-1">
                    <span>Grade 3</span>
                    <span>Grade 12</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !subject || !topic}
                  className="w-full py-4 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Materials...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Curriculum
                    </>
                  )}
                </button>
              </form>
            </motion.div>

            {/* Error State */}
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                <p className="text-sm font-medium">{error}</p>
              </motion.div>
            )}

            {/* Results */}
            {curriculum && lessonMeta && (
              <CurriculumDisplay
                key={lessonMeta.id}
                curriculum={curriculum}
                title={`${lessonMeta.subject}: ${lessonMeta.topic}`}
                subtitle={lessonMeta.gradeLevel}
                studentName={activeLesson?.studentName ?? selectedStudent?.name}
                results={activeLesson?.results}
                onSaveResults={handleSaveResults}
                onRegenerateSection={handleRegenerateSection}
              />
            )}

            {/* Saved Lessons */}
            <LessonLibrary activeLessonId={lessonMeta?.id ?? null} onLoad={handleLoadLesson} />
          </>
        )}

        {activeTab === 'tools' && <MathTools />}

        {activeTab === 'reading' && <ReadingAnalyzer />}

        {activeTab === 'testprep' && <TestPrep onGoToStudents={goToStudents} />}

        {activeTab === 'assessor' && (
          <>
            <div className="mb-6 print:hidden"><HelpCallout id="assessor" steps={helpSteps('assessor')} defaultOpen={false} /></div>
            <GradeAssessor />
          </>
        )}

        {activeTab === 'gaps' && (
          <>
            <div className="mb-6 print:hidden"><HelpCallout id="gaps" steps={helpSteps('gaps')} defaultOpen={false} /></div>
            <GapAnalyzer />
          </>
        )}

        {activeTab === 'year' && (
          <>
            <div className="mb-6 print:hidden"><HelpCallout id="year" steps={helpSteps('year')} defaultOpen={false} /></div>
            <YearPlanner
              onGenerateLesson={handlePlanLessonRequest}
              onOpenLesson={handleOpenLessonFromPlan}
              isGeneratingLesson={isLoading}
            />
          </>
        )}

        {activeTab === 'calendar' && (
          <PlannerCalendar onGoToStudents={goToStudents} onOpenLesson={handleOpenLessonById} />
        )}

        {activeTab === 'standards' && <Standards onGoToStudents={goToStudents} />}

        {activeTab === 'reports' && <Reports onGoToStudents={goToStudents} />}

        {activeTab === 'timelog' && (
          <>
            <div className="mb-6 print:hidden"><HelpCallout id="timelog" steps={helpSteps('timelog')} defaultOpen={false} /></div>
            <TimeLog />
          </>
        )}

        {activeTab === 'attendance' && <Attendance onGoToStudents={goToStudents} />}

        {activeTab === 'activities' && <Activities onGoToStudents={goToStudents} />}

        {activeTab === 'worksamples' && <WorkSamples onGoToStudents={goToStudents} />}

        {activeTab === 'collaborate' && <Collaboration onGoToStudents={goToStudents} />}

        {activeTab === 'students' && <StudentManager />}

        {activeTab === 'settings' && <Settings />}

        {activeTab === 'guide' && <Guide onOpenTab={(id) => setActiveTab(id as TabId)} />}

      </div>
    </div>
  );
}
