import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader2, AlertCircle, CalendarDays, BookOpen, Clock, User, CheckCircle2, Circle, Printer, Sparkles, Trash2, FolderOpen, Users } from 'lucide-react';
import { QuarterlyCurriculum, PlanSource, SavedLesson, SubjectPlan, WeeklyPlan } from '../types';
import { useStudents } from '../StudentContext';
import { postJson } from '../api';
import { exportElementToPdf } from '../pdf';

interface Props {
  onGenerateLesson: (subject: string, topic: string, gradeLevel: string, source: PlanSource) => void;
  onOpenLesson: (lesson: SavedLesson) => void;
  isGeneratingLesson: boolean;
}

function summarizeQuarters(quarters: QuarterlyCurriculum[]): string {
  return quarters
    .map((q, qi) =>
      q.subjects
        .map(s => `Quarter ${qi + 1} ${s.subject}: ${s.weekly_plan.map(w => w.topic).join('; ')}`)
        .join('\n')
    )
    .join('\n');
}

export function YearPlanner({ onGenerateLesson, onOpenLesson, isGeneratingLesson }: Props) {
  const { selectedStudent, yearPlans, lessons, upsertYearPlanQuarter, toggleWeekComplete, deleteYearPlan, updateStudent } = useStudents();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schedulingNotes, setSchedulingNotes] = useState('');

  // Remember the teacher's scheduling notes per student (they're reused across quarters).
  useEffect(() => {
    setSchedulingNotes(selectedStudent?.schedulingNotes || '');
  }, [selectedStudent?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeQuarter, setActiveQuarter] = useState(0);
  const [planView, setPlanView] = useState<'subject' | 'week'>('subject');
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const plan = selectedStudent ? yearPlans.find(p => p.studentId === selectedStudent.id) ?? null : null;
  const quarter = plan?.quarters[Math.min(activeQuarter, (plan?.quarters.length ?? 1) - 1)] ?? null;
  const quarterIndex = plan ? Math.min(activeQuarter, plan.quarters.length - 1) : 0;

  const totalWeeks = plan?.quarters.reduce((sum, q) => sum + q.subjects.reduce((s, subj) => s + subj.weekly_plan.length, 0), 0) ?? 0;
  const doneWeeks = plan?.quarters.reduce((sum, q) => sum + q.subjects.reduce((s, subj) => s + subj.weekly_plan.filter(w => w.completed).length, 0), 0) ?? 0;
  const progressPct = totalWeeks > 0 ? Math.round((doneWeeks / totalWeeks) * 100) : 0;

  const lessonForWeek = (qi: number, si: number, wi: number): SavedLesson | undefined => {
    if (!plan) return undefined;
    return lessons.find(l =>
      l.source &&
      l.source.yearPlanId === plan.id &&
      l.source.quarterIndex === qi &&
      l.source.subjectIndex === si &&
      l.source.weekIndex === wi
    );
  };

  const handleGenerate = async (mode: 'next' | 'fullYear') => {
    if (!selectedStudent || isGenerating) return;
    setIsGenerating(true);
    setError(null);

    // Persist the scheduling notes on the profile so they carry across quarters and back up.
    const notes = schedulingNotes.trim();
    if (notes !== (selectedStudent.schedulingNotes || '')) {
      updateStudent(selectedStudent.id, { schedulingNotes: notes || undefined });
    }

    try {
      const acc = [...(plan?.quarters ?? [])];
      const targets = mode === 'next'
        ? [acc.length]
        : [0, 1, 2, 3].filter(i => i >= acc.length);

      for (const qi of targets) {
        if (qi > 3) break;
        setGenerationStatus(`Generating Quarter ${qi + 1} of 4… this can take a minute.`);
        const data = await postJson<QuarterlyCurriculum>('/api/quarter-planner', {
          studentName: selectedStudent.name,
          gradeLevel: selectedStudent.gradeLevel,
          learningNeeds: selectedStudent.learningNeeds,
          interests: selectedStudent.interests,
          schedulingNotes: notes || undefined,
          quarterNumber: qi + 1,
          previousQuarters: acc.length > 0 ? summarizeQuarters(acc) : undefined
        });
        acc.push(data);
        upsertYearPlanQuarter(selectedStudent, qi, data);
        setActiveQuarter(qi);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
      setGenerationStatus(null);
    }
  };

  const handleExportPDF = async () => {
    if (!contentRef.current || !plan) return;
    setIsExporting(true);
    try {
      await exportElementToPdf(contentRef.current, { filename: `${plan.studentName}-quarter-${quarterIndex + 1}-plan.pdf` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleStartOver = () => {
    if (!plan) return;
    if (confirm(`Delete ${plan.studentName}'s entire year plan? Saved lessons stay in the Lesson Library, but week checkmarks and the plan itself will be removed.`)) {
      deleteYearPlan(plan.id);
      setActiveQuarter(0);
    }
  };

  // One week cell — shared by both the by-subject and by-week layouts.
  const renderWeekCell = (subject: SubjectPlan, subjectIdx: number, week: WeeklyPlan, weekIdx: number, showSubject: boolean) => {
    if (!plan) return null;
    const source: PlanSource = { yearPlanId: plan.id, quarterIndex, subjectIndex: subjectIdx, weekIndex: weekIdx };
    const linkedLesson = lessonForWeek(quarterIndex, subjectIdx, weekIdx);
    return (
      <div key={`${subjectIdx}-${weekIdx}`} className={`p-5 rounded-xl border transition-colors ${week.completed ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-100'}`}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleWeekComplete(source)}
              className={`shrink-0 transition-colors print:hidden ${week.completed ? 'text-emerald-500 hover:text-emerald-600' : 'text-gray-300 hover:text-gray-400'}`}
              title={week.completed ? 'Mark week as not done' : 'Mark week as done'}
            >
              {week.completed ? <CheckCircle2 className="w-7 h-7" /> : <Circle className="w-7 h-7" />}
            </button>
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-sm shrink-0">
              W{week.week}
            </span>
            {showSubject && (
              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold shrink-0">{subject.subject}</span>
            )}
            <h3 className={`font-bold text-lg ${week.completed ? 'text-emerald-900' : 'text-gray-900'}`}>{week.topic}</h3>
          </div>
          <div className="print:hidden">
            {linkedLesson ? (
              <button
                onClick={() => onOpenLesson(linkedLesson)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors text-sm font-semibold shadow-sm"
              >
                <FolderOpen className="w-4 h-4" />
                Open Lesson
                {linkedLesson.results?.completedDate && <CheckCircle2 className="w-4 h-4" />}
              </button>
            ) : (
              <button
                onClick={() => onGenerateLesson(subject.subject, week.topic, plan.gradeLevel, source)}
                disabled={isGeneratingLesson}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors text-sm font-semibold shadow-sm disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                Generate Lesson
              </button>
            )}
          </div>
        </div>
        <div className="ml-11 space-y-4">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Learning Objective:</span>
            <p className="text-gray-700">{week.learning_objective}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-indigo-50">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Assessment Check
            </span>
            <p className="text-gray-800 font-medium text-sm">{week.assessment_check}</p>
          </div>
        </div>
      </div>
    );
  };

  if (!selectedStudent) {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-14 text-center text-gray-500"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 mb-5">
          <CalendarDays className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Select a student first</h2>
        <p className="max-w-sm mx-auto">The Year Planner builds a persistent four-quarter school year for one student.<br />Choose or create a profile in the <span className="font-semibold">Students</span> tab, then come back here.</p>
      </motion.div>
    );
  }

  return (
    <div className="w-full">
      {/* Plan header / controls */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-8 print:hidden"
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedStudent.name}'s School Year</h2>
              <p className="text-gray-500 text-sm">{selectedStudent.gradeLevel} · four 9-week quarters, each building on the last</p>
            </div>
          </div>
          {plan && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-semibold disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                Export Q{quarterIndex + 1} PDF
              </button>
              <button
                onClick={handleStartOver}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-500 rounded-lg hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors shadow-sm text-sm font-semibold"
                title="Delete this year plan and start fresh"
              >
                <Trash2 className="w-4 h-4" />
                Start Over
              </button>
            </div>
          )}
        </div>

        {/* Progress */}
        {plan && totalWeeks > 0 && (
          <div className="mt-6">
            <div className="flex justify-between text-sm font-medium text-gray-600 mb-2">
              <span>Year progress</span>
              <span>{doneWeeks} of {totalWeeks} week-topics complete ({progressPct}%)</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* Scheduling notes — factored into the generated daily schedule template */}
        {plan?.quarters.length !== 4 && (
          <div className="mt-6 space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Scheduling notes for the daily schedule (optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Co-op every Tuesday; speech therapy Thursdays at 2pm; keep mornings short; movement break after each subject."
              value={schedulingNotes}
              onChange={(e) => setSchedulingNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
            />
            <p className="text-xs text-gray-400">Saved to {selectedStudent.name}'s profile and applied to every quarter's daily schedule.</p>
          </div>
        )}

        {/* Generation controls */}
        <div className="mt-6 flex flex-wrap gap-3">
          {!plan && (
            <>
              <button
                onClick={() => handleGenerate('fullYear')}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all disabled:opacity-50 shadow-sm"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Generate Full Year (4 Quarters)
              </button>
              <button
                onClick={() => handleGenerate('next')}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-semibold transition-all disabled:opacity-50 shadow-sm"
              >
                <CalendarDays className="w-5 h-5" />
                Start with Quarter 1 Only
              </button>
            </>
          )}
          {plan && plan.quarters.length < 4 && (
            <button
              onClick={() => handleGenerate('next')}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all disabled:opacity-50 shadow-sm"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Generate Quarter {plan.quarters.length + 1} (builds on Q1–Q{plan.quarters.length})
            </button>
          )}
        </div>

        {generationStatus && (
          <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-800 text-sm font-medium flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {generationStatus}
          </div>
        )}
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800 print:hidden"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}

      {plan && quarter && (
        <>
          {/* Quarter tabs */}
          <div className="flex justify-center mb-8 print:hidden">
            <div className="inline-flex bg-gray-100/80 p-1 rounded-2xl border border-gray-200 shadow-inner gap-1">
              {[0, 1, 2, 3].map(qi => {
                const exists = qi < plan.quarters.length;
                return (
                  <button
                    key={qi}
                    onClick={() => exists && setActiveQuarter(qi)}
                    disabled={!exists}
                    className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      quarterIndex === qi && exists
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : exists
                          ? 'text-gray-500 hover:text-gray-900'
                          : 'text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Q{qi + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={contentRef} className="space-y-8 pb-12">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">{plan.studentName} — Quarter {quarterIndex + 1}</h1>
              <p className="text-lg text-gray-600 mt-1">{plan.gradeLevel}</p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-sm p-8 text-white print:bg-white print:text-gray-900 print:border print:border-gray-200 print:shadow-none"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm print:bg-gray-100 print:text-gray-900">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Teacher's Guide</h2>
                  <p className="text-indigo-100 print:text-gray-500 text-sm">Keeping on schedule & ensuring mastery</p>
                </div>
              </div>
              <div className="prose prose-invert print:prose-slate max-w-none text-white/90 print:text-gray-700 leading-relaxed whitespace-pre-wrap">
                {quarter.teacher_guide}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Clock className="w-6 h-6 text-emerald-500" />
                Daily Schedule Template
              </h2>
              <div className="prose prose-slate max-w-none text-gray-700 whitespace-pre-wrap">
                {quarter.daily_schedule_template}
              </div>
            </motion.div>

            {/* Sort toggle: view the quarter grouped by subject or by week */}
            <div className="flex justify-center print:hidden">
              <div className="inline-flex items-center gap-2 bg-gray-100/80 p-1 rounded-2xl border border-gray-200 shadow-inner">
                <span className="text-xs font-semibold text-gray-400 pl-3 pr-1">Sort by</span>
                <button onClick={() => setPlanView('subject')} className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${planView === 'subject' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Subject</button>
                <button onClick={() => setPlanView('week')} className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${planView === 'week' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Week</button>
              </div>
            </div>

            {planView === 'subject' ? (
              quarter.subjects.map((subject, subjectIdx) => (
                <div key={subjectIdx} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 break-inside-avoid">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{subject.subject}</h2>
                      <p className="text-gray-500 text-sm mt-1">{subject.overview}</p>
                    </div>
                  </div>
                  <div className="space-y-6 mt-8">
                    {subject.weekly_plan.map((week, weekIdx) => renderWeekCell(subject, subjectIdx, week, weekIdx, false))}
                  </div>
                </div>
              ))
            ) : (
              Array.from({ length: Math.max(0, ...quarter.subjects.map(s => s.weekly_plan.length)) }).map((_, wi) => (
                <div key={wi} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 break-inside-avoid">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Week {wi + 1}</h2>
                  </div>
                  <div className="space-y-6 mt-8">
                    {quarter.subjects.map((subject, subjectIdx) =>
                      subject.weekly_plan[wi] ? renderWeekCell(subject, subjectIdx, subject.weekly_plan[wi], wi, true) : null
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
