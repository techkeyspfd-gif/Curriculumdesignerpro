import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { MessagesSquare, Send, Trash2, History, BookOpen, Images, Trophy, GraduationCap, Users2, CloudUpload, Info } from 'lucide-react';
import { Observation } from '../types';
import { useStudents } from '../StudentContext';
import { Panel, SectionHeader, HelpCallout, NeedsStudent } from './ui';
import { helpSteps } from '../guideContent';

const CATEGORIES = ['Win', 'Milestone', 'Concern', 'Behavior', 'Idea', 'General'];
const CAT_TINT: Record<string, string> = {
  Win: 'bg-emerald-100 text-emerald-700', Milestone: 'bg-violet-100 text-violet-700',
  Concern: 'bg-red-100 text-red-700', Behavior: 'bg-amber-100 text-amber-700',
  Idea: 'bg-sky-100 text-sky-700', General: 'bg-gray-100 text-gray-600',
};

interface TimelineItem { date: string; icon: any; text: string; tint: string }

export function Collaboration({ onGoToStudents }: { onGoToStudents?: () => void }) {
  const { selectedStudent, observations, addObservation, deleteObservation, lessons, workSamples, activities } = useStudents();
  const [author, setAuthor] = useState(() => localStorage.getItem('collabAuthor') || '');
  const [category, setCategory] = useState('Win');
  const [text, setText] = useState('');

  const studentObs = useMemo(
    () => (selectedStudent ? observations.filter(o => o.studentId === selectedStudent.id).slice().sort((a, b) => b.date.localeCompare(a.date)) : []),
    [observations, selectedStudent]
  );

  // Derived activity timeline: everything that "happened" for this student.
  const timeline = useMemo<TimelineItem[]>(() => {
    if (!selectedStudent) return [];
    const items: TimelineItem[] = [];
    lessons.filter(l => l.studentId === selectedStudent.id && l.results?.completedDate).forEach(l =>
      items.push({ date: l.results!.completedDate!, icon: BookOpen, text: `Completed lesson: ${l.subject} — ${l.topic}`, tint: 'text-emerald-500' }));
    workSamples.filter(w => w.studentId === selectedStudent.id).forEach(w =>
      items.push({ date: w.date, icon: Images, text: `Added work sample: ${w.title}`, tint: 'text-rose-500' }));
    activities.filter(a => a.studentId === selectedStudent.id).forEach(a =>
      items.push({ date: a.date, icon: Trophy, text: `${a.category}: ${a.title}`, tint: 'text-amber-500' }));
    selectedStudent.assessmentHistory.forEach(r =>
      items.push({ date: r.date, icon: GraduationCap, text: `Assessed ${r.subject}: ${r.assessment.suggested_grade}`, tint: 'text-indigo-500' }));
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  }, [selectedStudent, lessons, workSamples, activities]);

  if (!selectedStudent) {
    return <NeedsStudent icon={MessagesSquare} label="Shared notes and the activity timeline are kept per student." onGoToStudents={onGoToStudents} />;
  }

  const post = () => {
    if (!text.trim()) return;
    const name = author.trim() || 'Parent';
    localStorage.setItem('collabAuthor', name);
    const obs: Observation = {
      id: crypto.randomUUID(), studentId: selectedStudent.id, date: new Date().toISOString(),
      author: name, category, text: text.trim()
    };
    addObservation(obs);
    setText('');
  };

  const inputCls = "px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm";

  return (
    <div className="w-full space-y-6">
      <Panel>
        <SectionHeader icon={MessagesSquare} title="Family Notes & Co-Teaching" subtitle={`Shared observations about ${selectedStudent.name}`} tint="violet" />
        <div className="mb-5"><HelpCallout id="collaborate" steps={helpSteps('collaborate')} /></div>

        {/* co-parent sharing explainer */}
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-sky-50 border border-sky-100 p-4 text-sm text-sky-900">
          <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold">Sharing with a co-parent or co-teacher:</span> this app keeps records on each device.
            Turn on <span className="inline-flex items-center gap-1 font-medium"><CloudUpload className="w-3.5 h-3.5" />Google Drive backup</span> in
            the Students tab (or export the backup file) and have the other guardian import it — you'll both see the same notes, plans, and work.
          </p>
        </div>

        {/* new note */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-xs font-semibold text-gray-600">Your name</label>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. Mom, Dad, Grandma" className={`block mt-1 w-40 ${inputCls}`} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`block mt-1 ${inputCls}`}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Share an observation about ${selectedStudent.name} — a win, a concern, or something the other parent should know…`}
            className={`w-full ${inputCls} resize-none`} />
          <button onClick={post} disabled={!text.trim()} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm disabled:opacity-50">
            <Send className="w-4 h-4" /> Post note
          </button>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* observations */}
        <Panel delay={0.05}>
          <SectionHeader icon={Users2} title="Shared notes" subtitle={`${studentObs.length} note${studentObs.length === 1 ? '' : 's'}`} tint="indigo" />
          {studentObs.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">No notes yet. Observations you and any co-parent add will appear here.</p>
          ) : (
            <div className="space-y-3">
              {studentObs.map(o => (
                <div key={o.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{o.author}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${CAT_TINT[o.category || 'General']}`}>{o.category}</span>
                      <span className="text-xs text-gray-400">{new Date(o.date).toLocaleDateString()}</span>
                    </div>
                    <button onClick={() => deleteObservation(o.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap">{o.text}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* activity timeline */}
        <Panel delay={0.1}>
          <SectionHeader icon={History} title="Activity timeline" subtitle="What's been done recently" tint="emerald" />
          {timeline.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">Completed lessons, work samples, activities, and assessments will show up here as a shared log.</p>
          ) : (
            <div className="space-y-2.5">
              {timeline.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${item.tint}`} />
                    <div className="min-w-0 flex-1">
                      <span className="text-gray-700">{item.text}</span>
                      <span className="text-gray-400 text-xs ml-2">{new Date(item.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
