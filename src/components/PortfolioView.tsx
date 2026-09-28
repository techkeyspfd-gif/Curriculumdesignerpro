import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { FileArchive, Printer, Loader2, CheckCircle2, BookOpen, BarChart3, GraduationCap } from 'lucide-react';
import { StudentProfile, Score } from '../types';
import { useStudents } from '../StudentContext';
import { exportElementToPdf } from '../pdf';

interface Props {
  student: StudentProfile;
}

const pct = (s: Score) => Math.round((s.correct / s.total) * 100);

function averageScore(scores: Score[]): number | null {
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, s) => sum + (s.correct / s.total) * 100, 0) / scores.length);
}

export function PortfolioView({ student }: Props) {
  const { lessons, yearPlans } = useStudents();
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const studentLessons = lessons.filter(l => l.studentId === student.id);
  const completedLessons = studentLessons.filter(l => l.results?.completedDate);
  const plan = yearPlans.find(p => p.studentId === student.id);

  const quizScores = completedLessons.map(l => l.results!.quizScore).filter((s): s is Score => !!s);
  const worksheetScores = completedLessons.map(l => l.results!.worksheetScore).filter((s): s is Score => !!s);
  const avgQuiz = averageScore(quizScores);
  const avgWorksheet = averageScore(worksheetScores);

  // Aggregate year-plan coverage per subject across all generated quarters.
  const subjectCoverage: { subject: string; done: number; total: number }[] = [];
  if (plan) {
    const map = new Map<string, { done: number; total: number }>();
    for (const quarter of plan.quarters) {
      for (const subj of quarter.subjects) {
        const entry = map.get(subj.subject) ?? { done: 0, total: 0 };
        entry.total += subj.weekly_plan.length;
        entry.done += subj.weekly_plan.filter(w => w.completed).length;
        map.set(subj.subject, entry);
      }
    }
    for (const [subject, { done, total }] of map) {
      subjectCoverage.push({ subject, done, total });
    }
  }

  const hasAnyRecords = studentLessons.length > 0 || student.assessmentHistory.length > 0 || !!plan;

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    setIsExporting(true);
    try {
      await exportElementToPdf(contentRef.current, { filename: `${student.name}-portfolio-${new Date().toISOString().slice(0, 10)}.pdf` });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.18 }}
      className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
    >
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <FileArchive className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Portfolio & Records</h3>
            <p className="text-gray-500 text-sm">Printable homeschool records for {student.name} — useful for state record-keeping requirements</p>
          </div>
        </div>
        {hasAnyRecords && (
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-sm disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {isExporting ? 'Generating PDF...' : 'Export Portfolio PDF'}
          </button>
        )}
      </div>

      {!hasAnyRecords ? (
        <p className="text-gray-500 text-sm py-4">
          No records yet. Generated lessons, recorded scores, assessments, and year-plan progress will all appear here automatically.
        </p>
      ) : (
        <div ref={contentRef} className="space-y-8 bg-white">
          {/* Portfolio header */}
          <div className="text-center border-b-2 border-gray-200 pb-5">
            <h1 className="text-2xl font-bold text-gray-900">Homeschool Portfolio — {student.name}</h1>
            <p className="text-gray-600 mt-1">{student.gradeLevel} · Report generated {new Date().toLocaleDateString()}</p>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
              <div className="text-3xl font-bold text-gray-900">{studentLessons.length}</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">Lessons Generated</div>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
              <div className="text-3xl font-bold text-emerald-600">{completedLessons.length}</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">Lessons Completed</div>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
              <div className="text-3xl font-bold text-indigo-600">{avgQuiz !== null ? `${avgQuiz}%` : '—'}</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">Avg Quiz Score</div>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
              <div className="text-3xl font-bold text-indigo-600">{avgWorksheet !== null ? `${avgWorksheet}%` : '—'}</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">Avg Worksheet Score</div>
            </div>
          </div>

          {/* Year plan coverage */}
          {subjectCoverage.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                Year Plan Coverage
              </h2>
              <div className="space-y-3">
                {subjectCoverage.map(({ subject, done, total }) => (
                  <div key={subject}>
                    <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                      <span>{subject}</span>
                      <span>{done} / {total} weeks</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed lessons */}
          {completedLessons.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-500" />
                Completed Lessons
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Subject</th>
                      <th className="py-2 pr-4">Topic</th>
                      <th className="py-2 pr-4">Worksheet</th>
                      <th className="py-2 pr-4">Quiz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedLessons.map(l => (
                      <tr key={l.id} className="border-b border-gray-100 text-gray-700">
                        <td className="py-2.5 pr-4 whitespace-nowrap">{new Date(l.results!.completedDate!).toLocaleDateString()}</td>
                        <td className="py-2.5 pr-4">{l.subject}</td>
                        <td className="py-2.5 pr-4 font-medium text-gray-900">{l.topic}</td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          {l.results!.worksheetScore ? `${l.results!.worksheetScore.correct}/${l.results!.worksheetScore.total} (${pct(l.results!.worksheetScore)}%)` : '—'}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          {l.results!.quizScore ? `${l.results!.quizScore.correct}/${l.results!.quizScore.total} (${pct(l.results!.quizScore)}%)` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Assessment history */}
          {student.assessmentHistory.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-500" />
                Grade Level Assessments
              </h2>
              <div className="space-y-2">
                {student.assessmentHistory.map((record, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-gray-500 whitespace-nowrap">{new Date(record.date).toLocaleDateString()}</span>
                      <span className="font-medium text-gray-900 truncate">{record.subject}: {record.topic}</span>
                    </div>
                    <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-700 whitespace-nowrap">
                      {record.assessment.suggested_grade}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
