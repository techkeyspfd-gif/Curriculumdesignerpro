import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Loader2, Sparkles, AlertCircle, CheckCircle2, Trash2, Target, Eye, EyeOff, FolderOpen } from 'lucide-react';
import { TestPrepSet, TestQuestion, Score } from '../types';
import { useStudents } from '../StudentContext';
import { postJson } from '../api';
import { Panel, SectionHeader, HelpCallout, NeedsStudent } from './ui';
import { helpSteps } from '../guideContent';

const EXAM_TYPES = ['SAT', 'ACT', 'State Assessment', 'Diagnostic'];
const SECTIONS: Record<string, string[]> = {
  SAT: ['Reading & Writing', 'Math'],
  ACT: ['English', 'Math', 'Reading', 'Science'],
  'State Assessment': ['Math', 'Reading/ELA', 'Science', 'Social Studies'],
  Diagnostic: ['Math', 'Reading', 'Writing', 'Science'],
};

const pct = (s: Score) => Math.round((s.correct / s.total) * 100);

function Runner({ set, onScore }: { set: TestPrepSet; onScore: (score: Score) => void }) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [correct, setCorrect] = useState<Record<number, boolean>>({});

  const answered = Object.keys(correct).length;
  const numCorrect = Object.values(correct).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {set.questions.map((q: TestQuestion, i) => {
        const isRevealed = revealed[i];
        return (
          <div key={i} className="rounded-xl border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium text-gray-900 text-sm whitespace-pre-wrap">{i + 1}. {q.question}</div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 rounded-full px-2 py-0.5">{q.skill}</span>
            </div>
            {q.options.length > 0 && (
              <ul className="mt-2 space-y-1">
                {q.options.map((o, oi) => (
                  <li key={oi} className={`text-sm px-3 py-1.5 rounded-lg border ${isRevealed && o === q.answer ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-medium' : 'border-gray-100 text-gray-700'}`}>
                    {String.fromCharCode(65 + oi)}. {o}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button onClick={() => setRevealed(r => ({ ...r, [i]: !r[i] }))}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {isRevealed ? 'Hide answer' : 'Show answer & explanation'}
              </button>
              {isRevealed && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-xs text-gray-400">Mark:</span>
                  <button onClick={() => setCorrect(c => ({ ...c, [i]: true }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${correct[i] === true ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Correct</button>
                  <button onClick={() => setCorrect(c => ({ ...c, [i]: false }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${correct[i] === false ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Missed</button>
                </div>
              )}
            </div>
            {isRevealed && (
              <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm">
                <div className="text-emerald-700 font-semibold">Answer: {q.answer}</div>
                <div className="text-gray-600 mt-1">{q.explanation}</div>
              </div>
            )}
          </div>
        );
      })}
      <div className="sticky bottom-4 flex items-center justify-between gap-3 bg-white/95 backdrop-blur border border-gray-200 rounded-xl p-3 shadow-sm">
        <span className="text-sm text-gray-600">Scored {answered}/{set.questions.length} · {numCorrect} correct</span>
        <button
          onClick={() => onScore({ correct: numCorrect, total: set.questions.length })}
          disabled={answered === 0}
          className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold disabled:opacity-50">
          <CheckCircle2 className="w-4 h-4" /> Record score
        </button>
      </div>
    </div>
  );
}

export function TestPrep({ onGoToStudents }: { onGoToStudents?: () => void }) {
  const { selectedStudent, testPrepSets, addTestPrepSet, updateTestPrepSet, deleteTestPrepSet } = useStudents();
  const [examType, setExamType] = useState('SAT');
  const [section, setSection] = useState('Math');
  const [focus, setFocus] = useState('');
  const [count, setCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);

  const studentSets = useMemo(
    () => (selectedStudent ? testPrepSets.filter(s => s.studentId === selectedStudent.id) : []),
    [testPrepSets, selectedStudent]
  );
  const activeSet = studentSets.find(s => s.id === activeSetId) || null;

  if (!selectedStudent) {
    return <NeedsStudent icon={GraduationCap} label="Test prep sets are saved per student and track scores toward benchmarks." onGoToStudents={onGoToStudents} />;
  }

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const data = await postJson<{ questions: TestQuestion[] }>('/api/test-prep', {
        examType, section, gradeLevel: selectedStudent.gradeLevel,
        learningNeeds: selectedStudent.learningNeeds, interests: selectedStudent.interests,
        focusSkills: focus.trim() || undefined, count
      });
      const set: TestPrepSet = {
        id: crypto.randomUUID(), studentId: selectedStudent.id, createdDate: new Date().toISOString(),
        examType, section, gradeLevel: selectedStudent.gradeLevel, questions: data.questions || [], attempts: []
      };
      addTestPrepSet(set);
      setActiveSetId(set.id);
    } catch (e: any) {
      setError(e.message || 'Failed to generate test prep');
    } finally {
      setLoading(false);
    }
  };

  const recordScore = (score: Score) => {
    if (!activeSet) return;
    updateTestPrepSet(activeSet.id, {
      lastScore: score,
      attempts: [...(activeSet.attempts || []), { date: new Date().toISOString(), score }]
    });
  };

  return (
    <div className="w-full space-y-6">
      <Panel>
        <SectionHeader icon={GraduationCap} title="Standardized Test Prep" subtitle={`Practice sets & diagnostics for ${selectedStudent.name}`} tint="rose" />
        <div className="mb-5"><HelpCallout id="testprep" steps={helpSteps('testprep')} /></div>

        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Exam</label>
            <select value={examType} onChange={(e) => { setExamType(e.target.value); setSection(SECTIONS[e.target.value][0]); }}
              className="block mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm">
              {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Section</label>
            <select value={section} onChange={(e) => setSection(e.target.value)}
              className="block mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm">
              {(SECTIONS[examType] || []).map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600"># Questions</label>
            <input type="number" min={3} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))}
              className="block mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Focus skills (optional)</label>
            <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. fractions, comma rules"
              className="block mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm" />
          </div>
        </div>
        <button onClick={generate} disabled={loading}
          className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {loading ? 'Building practice set…' : 'Generate practice set'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
      </Panel>

      {activeSet && (
        <Panel delay={0.05}>
          <SectionHeader icon={Target} title={`${activeSet.examType} · ${activeSet.section}`} subtitle={`${activeSet.questions.length} questions · ${activeSet.gradeLevel}`} tint="indigo" />
          {activeSet.lastScore && (
            <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Last score: {activeSet.lastScore.correct}/{activeSet.lastScore.total} ({pct(activeSet.lastScore)}%)
            </div>
          )}
          <Runner set={activeSet} onScore={recordScore} />
        </Panel>
      )}

      {studentSets.length > 0 && (
        <Panel delay={0.1}>
          <SectionHeader icon={FolderOpen} title="Saved practice sets" subtitle="Reopen a set or track score history" tint="sky" />
          <div className="space-y-2">
            {studentSets.map(s => (
              <div key={s.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${activeSetId === s.id ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 bg-gray-50'}`}>
                <button onClick={() => setActiveSetId(s.id)} className="flex-1 text-left min-w-0">
                  <div className="font-medium text-gray-900 text-sm">{s.examType} · {s.section}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(s.createdDate).toLocaleDateString()} · {s.questions.length} Qs
                    {s.attempts && s.attempts.length > 0 && ` · ${s.attempts.length} attempt${s.attempts.length === 1 ? '' : 's'}`}
                    {s.lastScore && ` · best-recent ${pct(s.lastScore)}%`}
                  </div>
                </button>
                <button onClick={() => { deleteTestPrepSet(s.id); if (activeSetId === s.id) setActiveSetId(null); }}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
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
