import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpenCheck, Loader2, Sparkles, Save, Trash2, TrendingUp, Library, CheckCircle2, AlertCircle } from 'lucide-react';
import { ReadingAnalysis } from '../types';
import { useStudents } from '../StudentContext';
import { postJson } from '../api';
import { Panel, SectionHeader, HelpCallout } from './ui';
import { helpSteps } from '../guideContent';

// Pull the first number out of a grade band like "Grade 6-7" for charting.
function gradeNumber(g: string): number | null {
  const m = g.match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export function ReadingAnalyzer() {
  const { selectedStudent, readingAnalyses, addReadingAnalysis, deleteReadingAnalysis } = useStudents();
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Omit<ReadingAnalysis, 'id' | 'date' | 'label' | 'sample' | 'studentId'> | null>(null);
  const [savedTick, setSavedTick] = useState(false);

  const studentHistory = useMemo(
    () => (selectedStudent ? readingAnalyses.filter(r => r.studentId === selectedStudent.id) : readingAnalyses.filter(r => !r.studentId))
      .slice().sort((a, b) => a.date.localeCompare(b.date)),
    [readingAnalyses, selectedStudent]
  );

  const analyze = async () => {
    if (text.trim().length < 20) { setError('Please paste at least a few sentences.'); return; }
    setLoading(true); setError(null); setResult(null); setSavedTick(false);
    try {
      const data = await postJson<typeof result>('/api/reading-level', {
        text,
        targetGrade: selectedStudent?.gradeLevel,
        interests: selectedStudent?.interests
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Failed to analyze text');
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!result) return;
    const entry: ReadingAnalysis = {
      id: crypto.randomUUID(),
      studentId: selectedStudent?.id,
      date: new Date().toISOString(),
      label: label.trim() || (selectedStudent ? `${selectedStudent.name} sample` : 'Reading sample'),
      sample: text.slice(0, 400),
      ...result
    };
    addReadingAnalysis(entry);
    setSavedTick(true);
  };

  const trendPoints = studentHistory
    .map(r => ({ date: r.date, g: gradeNumber(r.gradeLevel), label: r.label }))
    .filter((p): p is { date: string; g: number; label: string } => p.g !== null);

  return (
    <div className="w-full space-y-6">
      <Panel>
        <SectionHeader
          icon={BookOpenCheck}
          title="Reading Level Analyzer"
          subtitle={selectedStudent ? `Analyzing for ${selectedStudent.name} · suggestions tuned to their interests` : 'Paste any text to measure its reading level'}
          tint="sky"
        />
        <div className="mb-5">
          <HelpCallout id="reading" steps={helpSteps('reading')} />
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Text to analyze</label>
            <textarea
              rows={7}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste an article, a passage, or your child's own writing here…"
              className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-y"
            />
            <div className="text-xs text-gray-400 mt-1">{text.trim().split(/\s+/).filter(Boolean).length} words</div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional, e.g. “March journal entry”)"
              className="flex-1 min-w-[220px] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
            <button
              onClick={analyze}
              disabled={loading || text.trim().length < 20}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[['Grade Level', result.gradeLevel], ['Lexile', result.lexile], ['Flesch-Kincaid', result.fleschKincaid]].map(([k, v]) => (
                <div key={k} className="p-4 rounded-xl bg-sky-50 border border-sky-100 text-center">
                  <div className="text-lg font-bold text-sky-700">{v}</div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">{k}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-sm text-gray-700 leading-relaxed">{result.analysis}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-2">Strengths</h4>
                <ul className="space-y-1.5">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-2">Suggestions to grow</h4>
                <ul className="space-y-1.5">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700"><TrendingUp className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2"><Library className="w-4 h-4 text-amber-500" /> Recommended reads</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                {result.recommendedTexts.map((b, i) => (
                  <div key={i} className="p-3 rounded-xl border border-gray-100 bg-white">
                    <div className="font-semibold text-gray-900 text-sm">{b.title}{b.author ? ` — ${b.author}` : ''}</div>
                    <div className="text-xs text-gray-500 mt-1">{b.why}</div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={save}
              disabled={savedTick}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-sm disabled:opacity-60"
            >
              {savedTick ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              {savedTick ? 'Saved to history' : selectedStudent ? `Save to ${selectedStudent.name}` : 'Save to history'}
            </button>
          </motion.div>
        )}
      </Panel>

      {/* Growth history */}
      {studentHistory.length > 0 && (
        <Panel delay={0.05}>
          <SectionHeader icon={TrendingUp} title="Reading growth" subtitle="Saved analyses over time" tint="emerald" />
          {trendPoints.length >= 2 && (
            <div className="mb-6">
              <div className="flex items-end gap-2 h-32">
                {trendPoints.map((p, i) => {
                  const max = Math.max(...trendPoints.map(t => t.g), 12);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${p.label}: grade ${p.g}`}>
                      <div className="w-full bg-emerald-400 rounded-t-md" style={{ height: `${(p.g / max) * 100}%` }} />
                      <span className="text-[10px] text-gray-400">{p.g}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">Estimated grade level per saved sample (left = oldest)</p>
            </div>
          )}
          <div className="space-y-2">
            {studentHistory.slice().reverse().map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">{r.label}</div>
                  <div className="text-xs text-gray-500">{new Date(r.date).toLocaleDateString()} · {r.gradeLevel} · {r.lexile}</div>
                </div>
                <button onClick={() => deleteReadingAnalysis(r.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
