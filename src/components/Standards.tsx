import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ListChecks, Loader2, Sparkles, AlertCircle, Trash2 } from 'lucide-react';
import { StandardMastery, MasteryLevel } from '../types';
import { useStudents } from '../StudentContext';
import { postJson } from '../api';
import { Panel, SectionHeader, HelpCallout, NeedsStudent, Bar } from './ui';
import { helpSteps } from '../guideContent';

export const FRAMEWORKS = [
  'Common Core', 'Next Generation Science Standards (NGSS)',
  'California CCSS', 'Texas TEKS', 'Florida B.E.S.T.', 'New York State Standards',
  'Virginia SOL', 'Classical / Charlotte Mason', 'Custom / Other'
];

const SUBJECTS = ['Math', 'English Language Arts', 'Science', 'Social Studies', 'History'];

export const MASTERY_META: Record<MasteryLevel, { label: string; color: string; bar: string; weight: number }> = {
  not_started: { label: 'Not started', color: 'text-gray-500 bg-gray-100', bar: 'bg-gray-300', weight: 0 },
  introduced: { label: 'Introduced', color: 'text-sky-700 bg-sky-100', bar: 'bg-sky-400', weight: 0.25 },
  developing: { label: 'Developing', color: 'text-amber-700 bg-amber-100', bar: 'bg-amber-400', weight: 0.5 },
  proficient: { label: 'Proficient', color: 'text-indigo-700 bg-indigo-100', bar: 'bg-indigo-500', weight: 0.8 },
  mastered: { label: 'Mastered', color: 'text-emerald-700 bg-emerald-100', bar: 'bg-emerald-500', weight: 1 },
};
const LEVELS = Object.keys(MASTERY_META) as MasteryLevel[];

export function Standards({ onGoToStudents }: { onGoToStudents?: () => void }) {
  const { selectedStudent, updateStudent, standards, addStandards, updateStandard, deleteStandard } = useStudents();
  const [subject, setSubject] = useState('Math');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const framework = selectedStudent?.standardsFramework || 'Common Core';

  const studentStandards = useMemo(
    () => (selectedStudent ? standards.filter(s => s.studentId === selectedStudent.id) : []),
    [standards, selectedStudent]
  );

  const bySubject = useMemo(() => {
    const map = new Map<string, StandardMastery[]>();
    for (const s of studentStandards) {
      const arr = map.get(s.subject) || [];
      arr.push(s);
      map.set(s.subject, arr);
    }
    return Array.from(map.entries());
  }, [studentStandards]);

  if (!selectedStudent) {
    return <NeedsStudent icon={ListChecks} label="Standards mastery is tracked per student against your chosen framework." onGoToStudents={onGoToStudents} />;
  }

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await postJson<{ standards: { code: string; subject: string; description: string }[] }>('/api/standards', {
        framework, subject, gradeLevel: selectedStudent.gradeLevel
      });
      const items: StandardMastery[] = (data.standards || []).map(s => ({
        id: crypto.randomUUID(), studentId: selectedStudent.id, framework,
        code: s.code, subject: s.subject, description: s.description,
        level: 'not_started', updatedDate: new Date().toISOString()
      }));
      addStandards(items);
    } catch (e: any) {
      setError(e.message || 'Failed to load standards');
    } finally {
      setLoading(false);
    }
  };

  const overallMastery = studentStandards.length > 0
    ? Math.round(studentStandards.reduce((sum, s) => sum + MASTERY_META[s.level].weight, 0) / studentStandards.length * 100)
    : 0;

  return (
    <div className="w-full space-y-6">
      <Panel>
        <SectionHeader icon={ListChecks} title="Standards Alignment" subtitle={`Track ${selectedStudent.name}'s mastery against a framework`} tint="emerald" />
        <div className="mb-5"><HelpCallout id="standards" steps={helpSteps('standards')} /></div>

        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-600">Framework</label>
            <select value={framework} onChange={(e) => updateStudent(selectedStudent.id, { standardsFramework: e.target.value })}
              className="block mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm">
              {FRAMEWORKS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}
              className="block mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm">
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? 'Loading…' : 'Load standards'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Framework is saved to {selectedStudent.name}'s profile and used to align generated curriculum.</p>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {studentStandards.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100">
            <div className="flex justify-between text-sm font-semibold text-gray-700 mb-1">
              <span>Overall mastery · {studentStandards.length} standards tracked</span>
              <span>{overallMastery}%</span>
            </div>
            <Bar value={overallMastery} max={100} color="bg-indigo-600" track="bg-white" />
          </div>
        )}
      </Panel>

      {bySubject.map(([subj, items], si) => (
        <Panel key={subj} delay={0.05 + si * 0.03}>
          <h3 className="text-lg font-bold text-gray-900 mb-4">{subj}</h3>
          <div className="space-y-3">
            {items.map(s => (
              <div key={s.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5">{s.code}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${MASTERY_META[s.level].color}`}>{MASTERY_META[s.level].label}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1.5">{s.description}</p>
                  </div>
                  <button onClick={() => deleteStandard(s.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 flex gap-1.5 flex-wrap">
                  {LEVELS.map(lvl => (
                    <button key={lvl}
                      onClick={() => updateStandard(s.id, { level: lvl, updatedDate: new Date().toISOString() })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${s.level === lvl ? `${MASTERY_META[lvl].color} border-current` : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {MASTERY_META[lvl].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
