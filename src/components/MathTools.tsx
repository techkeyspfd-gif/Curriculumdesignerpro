import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calculator, Loader2, Sparkles, AlertCircle, CheckCircle2, ListChecks, Repeat, ExternalLink, Ruler, FlaskConical } from 'lucide-react';
import { useStudents } from '../StudentContext';
import { postJson } from '../api';
import { Panel, SectionHeader, HelpCallout } from './ui';
import { helpSteps } from '../guideContent';

interface Solution {
  problem_restated: string;
  steps: { title: string; work: string; explanation: string }[];
  final_answer: string;
  check: string;
  common_mistakes: string[];
  similar_practice: { problem: string; answer: string }[];
}

const SUBJECTS = ['Math', 'Algebra', 'Geometry', 'Physics', 'Chemistry', 'Biology', 'Earth Science'];

// Curated, high-quality open educational STEM resources (static, no tracking).
const OER_RESOURCES = [
  { name: 'PhET Interactive Simulations', why: 'Free science & math simulations (physics, chemistry, biology).', url: 'https://phet.colorado.edu' },
  { name: 'Khan Academy', why: 'Video lessons and practice for every math & science topic.', url: 'https://www.khanacademy.org' },
  { name: 'Desmos Graphing Calculator', why: 'Visualize functions, geometry, and data for free.', url: 'https://www.desmos.com/calculator' },
  { name: 'CK-12 FlexBooks', why: 'Free adaptive STEM textbooks and practice.', url: 'https://www.ck12.org' },
  { name: 'NASA STEM Resources', why: 'Real-world science activities and data.', url: 'https://www.nasa.gov/stem' },
  { name: 'Math Learning Center Apps', why: 'Free virtual manipulatives (number lines, fractions, geoboard).', url: 'https://www.mathlearningcenter.org/apps' },
];

// Printable manipulative templates parents can generate elsewhere / print.
const MANIPULATIVES = [
  'Number line (0–20 and −10 to 10)',
  'Fraction strips / fraction circles',
  'Base-ten blocks grid',
  'Hundreds chart',
  'Coordinate grid (four-quadrant)',
  'Place-value chart',
];

export function MathTools() {
  const { selectedStudent } = useStudents();
  const [problem, setProblem] = useState('');
  const [subject, setSubject] = useState('Math');
  const [grade, setGrade] = useState(selectedStudent?.gradeLevel || 'Grade 6');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  const solve = async () => {
    if (!problem.trim()) return;
    setLoading(true); setError(null); setSolution(null); setShowAnswers(false);
    try {
      const data = await postJson<Solution>('/api/solve-problem', {
        problem, subject, gradeLevel: grade, learningNeeds: selectedStudent?.learningNeeds
      });
      setSolution(data);
    } catch (e: any) {
      setError(e.message || 'Failed to solve');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <Panel>
        <SectionHeader
          icon={Calculator}
          title="Math & Science Tools"
          subtitle="Step-by-step worked solutions and answer keys — so you can teach any problem"
          tint="violet"
        />
        <div className="mb-5"><HelpCallout id="tools" steps={helpSteps('tools')} /></div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Problem</label>
            <textarea
              rows={4}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g. A recipe needs 3/4 cup of sugar for 12 cookies. How much sugar for 30 cookies?"
              className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-y"
            />
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs font-semibold text-gray-600">Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}
                className="block mt-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all">
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Grade</label>
              <input value={grade} onChange={(e) => setGrade(e.target.value)}
                className="block mt-1 w-32 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
            </div>
            <button onClick={solve} disabled={loading || !problem.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? 'Solving…' : 'Solve & show work'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {solution && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-5">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Problem</div>
              <p className="text-sm text-gray-800">{solution.problem_restated}</p>
            </div>

            <div className="space-y-3">
              {solution.steps.map((s, i) => (
                <div key={i} className="flex gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <div className="flex-1 rounded-xl border border-gray-100 p-3">
                    <div className="font-semibold text-gray-900 text-sm">{s.title}</div>
                    <div className="mt-1 font-mono text-sm text-indigo-800 bg-indigo-50/60 rounded-lg px-3 py-2 whitespace-pre-wrap">{s.work}</div>
                    <div className="text-sm text-gray-600 mt-2">{s.explanation}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
              <div className="flex items-center gap-2 text-emerald-800 font-bold"><CheckCircle2 className="w-5 h-5" /> Final answer</div>
              <p className="text-lg font-bold text-gray-900 mt-1">{solution.final_answer}</p>
              <p className="text-sm text-emerald-900/80 mt-2"><span className="font-semibold">Check:</span> {solution.check}</p>
            </div>

            {solution.common_mistakes.length > 0 && (
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2"><ListChecks className="w-4 h-4 text-amber-500" /> Common mistakes</h4>
                <ul className="space-y-1.5">
                  {solution.common_mistakes.map((m, i) => <li key={i} className="flex gap-2 text-sm text-gray-700"><span className="text-amber-500">•</span>{m}</li>)}
                </ul>
              </div>
            )}

            {solution.similar_practice.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2"><Repeat className="w-4 h-4 text-indigo-500" /> Practice problems</h4>
                  <button onClick={() => setShowAnswers(v => !v)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                    {showAnswers ? 'Hide answer key' : 'Show answer key'}
                  </button>
                </div>
                <div className="space-y-2">
                  {solution.similar_practice.map((p, i) => (
                    <div key={i} className="p-3 rounded-xl border border-gray-100 text-sm">
                      <div className="text-gray-800">{i + 1}. {p.problem}</div>
                      {showAnswers && <div className="text-emerald-700 font-semibold mt-1">Answer: {p.answer}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </Panel>

      {/* Manipulatives + OER resources */}
      <div className="grid md:grid-cols-2 gap-6">
        <Panel delay={0.05}>
          <SectionHeader icon={Ruler} title="Printable manipulatives" subtitle="Hands-on math tools to print" tint="amber" />
          <ul className="space-y-2">
            {MANIPULATIVES.map(m => (
              <li key={m} className="flex items-center gap-2 text-sm text-gray-700 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <Ruler className="w-4 h-4 text-amber-500 shrink-0" />{m}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-3">Tip: search these names on the Math Learning Center or Math-Drills for free printable PDFs.</p>
        </Panel>

        <Panel delay={0.1}>
          <SectionHeader icon={FlaskConical} title="Quality STEM resources" subtitle="Free simulations & OER" tint="sky" />
          <div className="space-y-2">
            {OER_RESOURCES.map(r => (
              <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                <ExternalLink className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{r.name}</div>
                  <div className="text-xs text-gray-500">{r.why}</div>
                </div>
              </a>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
