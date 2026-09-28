import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, TrendingDown, Minus, Sparkles, Loader2, Printer, ListChecks, Clock, BookOpen, Award, FileText } from 'lucide-react';
import { Score, SavedLesson } from '../types';
import { useStudents } from '../StudentContext';
import { postJson } from '../api';
import { exportElementToPdf } from '../pdf';
import { Panel, SectionHeader, HelpCallout, NeedsStudent, Bar } from './ui';
import { helpSteps } from '../guideContent';
import { MASTERY_META } from './Standards';

const pct = (s: Score) => Math.round((s.correct / s.total) * 100);
function avg(nums: number[]): number | null { return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null; }
function lessonScore(l: SavedLesson): number | null {
  const parts: number[] = [];
  if (l.results?.worksheetScore) parts.push(pct(l.results.worksheetScore));
  if (l.results?.quizScore) parts.push(pct(l.results.quizScore));
  return parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
}

interface Summary { summary: string; highlights: string[]; focus_next: string[] }

export function Reports({ onGoToStudents }: { onGoToStudents?: () => void }) {
  const { selectedStudent, lessons, standards, dailyLogs, activities } = useStudents();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    if (!selectedStudent) return null;
    const sid = selectedStudent.id;
    const studentLessons = lessons.filter(l => l.studentId === sid);
    const completed = studentLessons.filter(l => l.results?.completedDate)
      .sort((a, b) => new Date(a.results!.completedDate!).getTime() - new Date(b.results!.completedDate!).getTime());

    // mastery by subject = avg lesson score per subject
    const subjMap = new Map<string, number[]>();
    completed.forEach(l => { const s = lessonScore(l); if (s !== null) { const arr = subjMap.get(l.subject) || []; arr.push(s); subjMap.set(l.subject, arr); } });
    const bySubject = Array.from(subjMap.entries()).map(([subject, scores]) => ({ subject, avg: avg(scores)!, count: scores.length })).sort((a, b) => b.avg - a.avg);

    // trend points
    const trend = completed.map(l => ({ date: l.results!.completedDate!, score: lessonScore(l), topic: l.topic })).filter(t => t.score !== null) as { date: string; score: number; topic: string }[];

    // earlier vs recent (split completed-with-score in half)
    const scored = trend.map(t => t.score);
    const mid = Math.floor(scored.length / 2);
    const earlier = avg(scored.slice(0, mid));
    const recent = avg(scored.slice(mid));

    // standards
    const studentStandards = standards.filter(s => s.studentId === sid);
    const stdCounts = { not_started: 0, introduced: 0, developing: 0, proficient: 0, mastered: 0 } as Record<string, number>;
    studentStandards.forEach(s => { stdCounts[s.level]++; });
    const mastered = stdCounts.proficient + stdCounts.mastered;

    const hours = Math.round(dailyLogs.filter(l => l.studentId === sid).reduce((sum, l) => sum + l.entries.reduce((s, e) => s + e.minutes, 0), 0) / 60 * 10) / 10;
    const activityCount = activities.filter(a => a.studentId === sid).length;

    return {
      studentLessons, completed, bySubject, trend, earlier, recent,
      studentStandards, stdCounts, mastered, hours, activityCount,
      avgQuiz: avg(completed.map(l => l.results?.quizScore).filter(Boolean).map(s => pct(s!))),
      avgWorksheet: avg(completed.map(l => l.results?.worksheetScore).filter(Boolean).map(s => pct(s!))),
    };
  }, [selectedStudent, lessons, standards, dailyLogs, activities]);

  if (!selectedStudent) {
    return <NeedsStudent icon={BarChart3} label="Progress reports visualize one student's mastery, trends, and standards." onGoToStudents={onGoToStudents} />;
  }

  const generateSummary = async () => {
    if (!data) return;
    setLoadingSummary(true); setSummaryError(null);
    try {
      const stats = {
        lessonsCompleted: data.completed.length,
        avgQuiz: data.avgQuiz, avgWorksheet: data.avgWorksheet,
        masteryBySubject: data.bySubject, hoursLogged: data.hours,
        standardsMastered: data.mastered, standardsTracked: data.studentStandards.length,
        activities: data.activityCount,
        trend: { earlier: data.earlier, recent: data.recent }
      };
      const res = await postJson<Summary>('/api/progress-summary', {
        studentName: selectedStudent.name, gradeLevel: selectedStudent.gradeLevel,
        learningNeeds: selectedStudent.learningNeeds, stats, period: 'this school year'
      });
      setSummary(res);
    } catch (e: any) {
      setSummaryError(e.message || 'Failed to generate summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleExport = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try { await exportElementToPdf(reportRef.current, { filename: `${selectedStudent.name}-progress-report-${new Date().toISOString().slice(0, 10)}.pdf` }); }
    finally { setIsExporting(false); }
  };

  const delta = data.earlier !== null && data.recent !== null ? data.recent - data.earlier : null;
  const trendMax = Math.max(100, ...data.trend.map(t => t.score));

  const hasData = data.completed.length > 0 || data.studentStandards.length > 0 || data.hours > 0;

  return (
    <div className="w-full space-y-6">
      <Panel>
        <SectionHeader
          icon={BarChart3} title="Progress Reports" subtitle={`${selectedStudent.name} · ${selectedStudent.gradeLevel}`} tint="indigo"
          action={hasData && (
            <button onClick={handleExport} disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-semibold disabled:opacity-50">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Export PDF
            </button>
          )}
        />
        <div className="mb-5"><HelpCallout id="reports" steps={helpSteps('reports')} /></div>

        {!hasData ? (
          <p className="text-gray-500 text-sm py-4">No data yet. Complete a few lessons (and record scores), log time, or track standards to see progress charts here.</p>
        ) : (
          <div ref={reportRef} className="bg-white space-y-8">
            <div className="hidden print:block border-b-2 border-gray-200 pb-4">
              <h1 className="text-2xl font-bold text-gray-900">Progress Report — {selectedStudent.name}</h1>
              <p className="text-gray-600">{selectedStudent.gradeLevel} · Generated {new Date().toLocaleDateString()}</p>
            </div>

            {/* stat tiles */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { icon: BookOpen, label: 'Lessons done', value: data.completed.length, tint: 'text-gray-900' },
                { icon: Award, label: 'Avg quiz', value: data.avgQuiz !== null ? `${data.avgQuiz}%` : '—', tint: 'text-indigo-600' },
                { icon: FileText, label: 'Avg worksheet', value: data.avgWorksheet !== null ? `${data.avgWorksheet}%` : '—', tint: 'text-indigo-600' },
                { icon: ListChecks, label: 'Standards proficient+', value: data.studentStandards.length ? `${data.mastered}/${data.studentStandards.length}` : '—', tint: 'text-emerald-600' },
                { icon: Clock, label: 'Hours logged', value: data.hours, tint: 'text-gray-900' },
              ].map(t => {
                const Icon = t.icon;
                return (
                  <div key={t.label} className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
                    <Icon className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                    <div className={`text-2xl font-bold ${t.tint}`}>{t.value}</div>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-1">{t.label}</div>
                  </div>
                );
              })}
            </div>

            {/* mastery by subject */}
            {data.bySubject.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-500" /> Mastery by subject</h3>
                <div className="space-y-3">
                  {data.bySubject.map(s => (
                    <div key={s.subject}>
                      <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                        <span>{s.subject} <span className="text-gray-400 font-normal">· {s.count} lesson{s.count === 1 ? '' : 's'}</span></span>
                        <span>{s.avg}%</span>
                      </div>
                      <Bar value={s.avg} max={100} color={s.avg >= 80 ? 'bg-emerald-500' : s.avg >= 60 ? 'bg-indigo-500' : 'bg-amber-500'} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* trend */}
            {data.trend.length >= 2 && (
              <div>
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-500" /> Score trend over time</h3>
                <div className="flex items-end gap-1.5 h-32">
                  {data.trend.map((t, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${t.topic}: ${t.score}%`}>
                      <div className={`w-full rounded-t ${t.score >= 80 ? 'bg-emerald-400' : t.score >= 60 ? 'bg-indigo-400' : 'bg-amber-400'}`} style={{ height: `${(t.score / trendMax) * 100}%` }} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">Each bar is one completed lesson's average score (left = earliest)</p>

                {/* semester comparison */}
                {delta !== null && (
                  <div className="mt-4 flex items-center justify-center gap-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="text-center"><div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Earlier</div><div className="text-2xl font-bold text-gray-700">{data.earlier}%</div></div>
                    <div className={`flex items-center gap-1 font-bold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {delta > 0 ? <TrendingUp className="w-5 h-5" /> : delta < 0 ? <TrendingDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                      {delta > 0 ? '+' : ''}{delta}%
                    </div>
                    <div className="text-center"><div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Recent</div><div className="text-2xl font-bold text-indigo-600">{data.recent}%</div></div>
                  </div>
                )}
              </div>
            )}

            {/* standards mastery */}
            {data.studentStandards.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><ListChecks className="w-5 h-5 text-emerald-500" /> Standards mastery</h3>
                <div className="flex h-6 rounded-full overflow-hidden border border-gray-100">
                  {(Object.keys(data.stdCounts) as (keyof typeof MASTERY_META)[]).map(lvl => {
                    const count = data.stdCounts[lvl];
                    if (!count) return null;
                    return <div key={lvl} className={MASTERY_META[lvl].bar} style={{ width: `${(count / data.studentStandards.length) * 100}%` }} title={`${MASTERY_META[lvl].label}: ${count}`} />;
                  })}
                </div>
                <div className="flex flex-wrap gap-3 mt-3 text-xs">
                  {(Object.keys(data.stdCounts) as (keyof typeof MASTERY_META)[]).map(lvl => data.stdCounts[lvl] > 0 && (
                    <span key={lvl} className="flex items-center gap-1.5 text-gray-600"><span className={`w-3 h-3 rounded ${MASTERY_META[lvl].bar}`} />{MASTERY_META[lvl].label} ({data.stdCounts[lvl]})</span>
                  ))}
                </div>
              </div>
            )}

            {/* AI narrative */}
            {summary && (
              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-500" /> Parent-friendly summary</h3>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{summary.summary}</p>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Highlights</div>
                    <ul className="space-y-1">{summary.highlights.map((h, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-emerald-500">✓</span>{h}</li>)}</ul>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Focus next</div>
                    <ul className="space-y-1">{summary.focus_next.map((f, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-indigo-500">→</span>{f}</li>)}</ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {hasData && (
          <div className="mt-6 print:hidden">
            <button onClick={generateSummary} disabled={loadingSummary}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm disabled:opacity-50">
              {loadingSummary ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loadingSummary ? 'Writing summary…' : summary ? 'Regenerate written summary' : 'Generate written summary'}
            </button>
            {summaryError && <p className="mt-2 text-sm text-red-600">{summaryError}</p>}
          </div>
        )}
      </Panel>
    </div>
  );
}
