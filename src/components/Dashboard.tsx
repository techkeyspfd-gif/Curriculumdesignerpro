import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, GraduationCap, FolderOpen, CalendarCheck, PartyPopper, Users, ArrowRight, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { PlanSource, SavedLesson, StudentProfile } from '../types';
import { useStudents } from '../StudentContext';
import { getStudentColor, colorForStudentId } from '../studentColors';

interface Props {
  onGenerateLesson: (subject: string, topic: string, gradeLevel: string, source: PlanSource) => void;
  onOpenLesson: (lesson: SavedLesson) => void;
  onGoToStudents: () => void;
  onGoToYearPlanner: () => void;
  isGeneratingLesson: boolean;
}

interface NextUp {
  subject: string;
  topic: string;
  source: PlanSource;
}

export function Dashboard({ onGenerateLesson, onOpenLesson, onGoToStudents, onGoToYearPlanner, isGeneratingLesson }: Props) {
  const { students, yearPlans, lessons, selectStudent } = useStudents();

  const findNextUp = (student: StudentProfile): NextUp | 'no-plan' | 'all-done' => {
    const plan = yearPlans.find(p => p.studentId === student.id);
    if (!plan) return 'no-plan';
    for (let qi = 0; qi < plan.quarters.length; qi++) {
      const quarter = plan.quarters[qi];
      for (let si = 0; si < quarter.subjects.length; si++) {
        const subject = quarter.subjects[si];
        for (let wi = 0; wi < subject.weekly_plan.length; wi++) {
          const week = subject.weekly_plan[wi];
          if (!week.completed) {
            return {
              subject: subject.subject,
              topic: week.topic,
              source: { yearPlanId: plan.id, quarterIndex: qi, subjectIndex: si, weekIndex: wi }
            };
          }
        }
      }
    }
    return plan.quarters.length > 0 ? 'all-done' : 'no-plan';
  };

  const lessonForSource = (source: PlanSource): SavedLesson | undefined =>
    lessons.find(l =>
      l.source &&
      l.source.yearPlanId === source.yearPlanId &&
      l.source.quarterIndex === source.quarterIndex &&
      l.source.subjectIndex === source.subjectIndex &&
      l.source.weekIndex === source.weekIndex
    );

  const recentLessons = [...lessons]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  if (students.length === 0) {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-14 text-center"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 mb-6">
          <GraduationCap className="w-10 h-10 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Curriculum Pro</h2>
        <p className="text-gray-500 max-w-md mx-auto mb-6">
          Add your first student to get started — their profile shapes every lesson, quiz, and plan the app generates for them.
        </p>
        <button
          onClick={onGoToStudents}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm"
        >
          <Users className="w-4 h-4" />
          Add a Student
        </button>
      </motion.div>
    );
  }

  return (
    <div className="w-full space-y-8">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Today</h2>
        <p className="text-gray-500 text-sm">What's next for each student, at a glance.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {students.map((student, idx) => {
          const color = getStudentColor(student.color || colorForStudentId(student.id).id);
          const nextUp = findNextUp(student);
          const linkedLesson = nextUp !== 'no-plan' && nextUp !== 'all-done' ? lessonForSource(nextUp.source) : undefined;

          return (
            <motion.div
              key={student.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.05 * idx }}
              className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${color.accentBorder} p-6`}
            >
              <div
                className="flex items-center gap-3 mb-5 cursor-pointer group"
                onClick={() => { selectStudent(student.id); onGoToStudents(); }}
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-white ${color.swatch}`}>
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{student.name}</h3>
                  <p className="text-gray-400 text-xs">{student.gradeLevel}</p>
                </div>
              </div>

              {nextUp === 'no-plan' && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-500">No year plan yet for {student.name}.</p>
                  <button
                    onClick={() => { selectStudent(student.id); onGoToYearPlanner(); }}
                    className="shrink-0 flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Start planning <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {nextUp === 'all-done' && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
                  <PartyPopper className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-sm text-emerald-800 font-medium">All caught up on the year plan!</p>
                </div>
              )}

              {nextUp !== 'no-plan' && nextUp !== 'all-done' && (
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Next Up · {nextUp.subject}</span>
                  <p className="font-semibold text-gray-900 mt-1 mb-3">{nextUp.topic}</p>
                  {linkedLesson ? (
                    <button
                      onClick={() => onOpenLesson(linkedLesson)}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors text-sm font-semibold shadow-sm"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Open Lesson
                      {linkedLesson.results?.completedDate && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        selectStudent(student.id);
                        onGenerateLesson(nextUp.subject, nextUp.topic, student.gradeLevel, nextUp.source);
                      }}
                      disabled={isGeneratingLesson}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-sm disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate Lesson
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Recent activity */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gray-100 text-gray-500 rounded-xl">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
            <p className="text-gray-500 text-sm">The last lessons generated across all students.</p>
          </div>
        </div>

        {recentLessons.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">Nothing generated yet — lessons will show up here as soon as you create one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentLessons.map(lesson => {
              const student = lesson.studentId ? students.find(s => s.id === lesson.studentId) : undefined;
              const color = student ? getStudentColor(student.color || colorForStudentId(student.id).id) : null;
              return (
                <button
                  key={lesson.id}
                  onClick={() => onOpenLesson(lesson)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {color && <span className={`w-2 h-2 rounded-full shrink-0 ${color.swatch}`} />}
                    <span className="font-medium text-gray-900 truncate">{lesson.topic}</span>
                    <span className="text-gray-400 text-sm shrink-0">{lesson.subject}</span>
                    {lesson.studentName && <span className="text-gray-400 text-sm shrink-0 hidden sm:inline">· {lesson.studentName}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lesson.results?.completedDate && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    <span className="text-gray-400 text-xs">{new Date(lesson.date).toLocaleDateString()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
