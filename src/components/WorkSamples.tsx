import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Images, Upload, Trash2, Tag, X, GitCompare, FileText, Loader2 } from 'lucide-react';
import { WorkSample } from '../types';
import { useStudents } from '../StudentContext';
import { Panel, SectionHeader, HelpCallout, NeedsStudent } from './ui';
import { helpSteps } from '../guideContent';

const MAX_BYTES = 2_500_000; // ~2.5MB per file to stay within localStorage limits

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Thumb({ s, className = '' }: { s: WorkSample; className?: string }) {
  if (s.fileType.startsWith('image/')) {
    return <img src={s.dataUrl} alt={s.title} className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
      <FileText className="w-8 h-8" />
    </div>
  );
}

export function WorkSamples({ onGoToStudents }: { onGoToStudents?: () => void }) {
  const { selectedStudent, workSamples, addWorkSample, deleteWorkSample } = useStudents();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ dataUrl: string; fileName: string; fileType: string } | null>(null);
  const [meta, setMeta] = useState({ title: '', subject: '', skill: '', date: todayKey(), notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [compare, setCompare] = useState<string[]>([]);

  const studentSamples = useMemo(
    () => (selectedStudent ? workSamples.filter(w => w.studentId === selectedStudent.id).slice().sort((a, b) => b.date.localeCompare(a.date)) : []),
    [workSamples, selectedStudent]
  );

  const subjects = useMemo(() => Array.from(new Set(studentSamples.map(s => s.subject).filter(Boolean))), [studentSamples]);
  const skills = useMemo(() => Array.from(new Set(studentSamples.map(s => s.skill).filter(Boolean) as string[])), [studentSamples]);

  const filtered = studentSamples.filter(s =>
    (!filterSubject || s.subject === filterSubject) && (!filterSkill || s.skill === filterSkill)
  );

  if (!selectedStudent) {
    return <NeedsStudent icon={Images} label="Work samples build a digital portfolio for one student." onGoToStudents={onGoToStudents} />;
  }

  const onFile = (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`That file is ${(file.size / 1e6).toFixed(1)}MB. Please use an image or PDF under 2.5MB (photos can be resized before uploading).`);
      return;
    }
    setLoadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      setPending({ dataUrl: String(reader.result), fileName: file.name, fileType: file.type || 'application/octet-stream' });
      setMeta(m => ({ ...m, title: m.title || file.name.replace(/\.[^.]+$/, '') }));
      setLoadingFile(false);
    };
    reader.onerror = () => { setError('Could not read that file.'); setLoadingFile(false); };
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!pending || !meta.title.trim()) return;
    addWorkSample({
      id: crypto.randomUUID(), studentId: selectedStudent.id, date: meta.date, title: meta.title.trim(),
      subject: meta.subject.trim() || 'General', skill: meta.skill.trim() || undefined,
      notes: meta.notes.trim() || undefined, fileName: pending.fileName, fileType: pending.fileType, dataUrl: pending.dataUrl
    });
    setPending(null);
    setMeta({ title: '', subject: meta.subject, skill: '', date: todayKey(), notes: '' });
  };

  const toggleCompare = (id: string) => {
    setCompare(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]);
  };
  const compareSamples = compare.map(id => studentSamples.find(s => s.id === id)).filter(Boolean) as WorkSample[];

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm";

  return (
    <div className="w-full space-y-6">
      <Panel>
        <SectionHeader icon={Images} title="Work Samples" subtitle={`${selectedStudent.name}'s digital portfolio`} tint="rose" />
        <div className="mb-5"><HelpCallout id="worksamples" steps={helpSteps('worksamples')} /></div>

        {!pending ? (
          <div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()}
              className="w-full py-10 rounded-2xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500">
              {loadingFile ? <Loader2 className="w-8 h-8 animate-spin text-indigo-400" /> : <Upload className="w-8 h-8 text-indigo-400" />}
              <span className="font-semibold text-gray-700">Upload a photo or PDF of student work</span>
              <span className="text-xs">Images or PDF, up to 2.5MB</span>
            </button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-[160px_1fr] gap-5">
            <div>
              <Thumb s={{ ...pending } as WorkSample} className="w-full h-40 rounded-xl border border-gray-100" />
              <button onClick={() => setPending(null)} className="mt-2 text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"><X className="w-3 h-3" /> Choose another file</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-gray-600">Title</label><input className={`mt-1 ${inputCls}`} value={meta.title} onChange={(e) => setMeta(m => ({ ...m, title: e.target.value }))} placeholder="e.g. Persuasive essay draft" /></div>
                <div><label className="text-xs font-semibold text-gray-600">Date</label><input type="date" className={`mt-1 ${inputCls}`} value={meta.date} max={todayKey()} onChange={(e) => setMeta(m => ({ ...m, date: e.target.value }))} /></div>
                <div><label className="text-xs font-semibold text-gray-600">Subject</label><input className={`mt-1 ${inputCls}`} value={meta.subject} onChange={(e) => setMeta(m => ({ ...m, subject: e.target.value }))} placeholder="e.g. Writing" /></div>
                <div><label className="text-xs font-semibold text-gray-600">Skill / standard (optional)</label><input className={`mt-1 ${inputCls}`} value={meta.skill} onChange={(e) => setMeta(m => ({ ...m, skill: e.target.value }))} placeholder="e.g. Thesis writing" /></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-600">Notes (optional)</label><textarea rows={2} className={`mt-1 ${inputCls} resize-none`} value={meta.notes} onChange={(e) => setMeta(m => ({ ...m, notes: e.target.value }))} /></div>
              <button onClick={save} disabled={!meta.title.trim()} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm disabled:opacity-50">
                <Upload className="w-5 h-5" /> Add to portfolio
              </button>
            </div>
          </motion.div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Panel>

      {/* comparison */}
      {compareSamples.length === 2 && (
        <Panel delay={0.05}>
          <SectionHeader icon={GitCompare} title="Growth comparison" subtitle="Two samples side by side" tint="violet" />
          <div className="grid grid-cols-2 gap-4">
            {compareSamples.sort((a, b) => a.date.localeCompare(b.date)).map(s => (
              <div key={s.id}>
                <div className="text-xs text-gray-400 mb-1">{new Date(s.date + 'T00:00').toLocaleDateString()}</div>
                <Thumb s={s} className="w-full h-64 rounded-xl border border-gray-100" />
                <div className="font-semibold text-gray-900 text-sm mt-2">{s.title}</div>
                <div className="text-xs text-gray-500">{s.subject}{s.skill ? ` · ${s.skill}` : ''}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* gallery */}
      <Panel delay={0.08}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <h3 className="text-lg font-bold text-gray-900">Portfolio ({studentSamples.length})</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {subjects.length > 0 && (
              <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none">
                <option value="">All subjects</option>
                {subjects.map(s => <option key={s}>{s}</option>)}
              </select>
            )}
            {skills.length > 0 && (
              <select value={filterSkill} onChange={(e) => setFilterSkill(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none">
                <option value="">All skills</option>
                {skills.map(s => <option key={s}>{s}</option>)}
              </select>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">No work samples yet. Upload your child's work above to start building their portfolio.</p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3">Tip: tap <GitCompare className="w-3 h-3 inline" /> on two samples to compare growth side by side.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map(s => {
                const inCompare = compare.includes(s.id);
                return (
                  <div key={s.id} className={`rounded-xl border overflow-hidden group ${inCompare ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-100'}`}>
                    <div className="relative">
                      <Thumb s={s} className="w-full h-32" />
                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => toggleCompare(s.id)} className={`p-1.5 rounded-lg shadow-sm ${inCompare ? 'bg-indigo-600 text-white' : 'bg-white/90 text-gray-600 hover:text-indigo-600'}`} title="Compare">
                          <GitCompare className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteWorkSample(s.id)} className="p-1.5 rounded-lg bg-white/90 text-gray-600 hover:text-red-500 shadow-sm" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="font-semibold text-gray-900 text-xs truncate">{s.title}</div>
                      <div className="text-[10px] text-gray-400">{new Date(s.date + 'T00:00').toLocaleDateString()}</div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{s.subject}</span>
                        {s.skill && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 flex items-center gap-0.5"><Tag className="w-2.5 h-2.5" />{s.skill}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
