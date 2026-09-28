import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Plus, Trash2, Printer, Loader2, MapPin, Clock, BookMarked, Save } from 'lucide-react';
import { Activity, ActivityCategory } from '../types';
import { useStudents } from '../StudentContext';
import { exportElementToPdf } from '../pdf';
import { Panel, SectionHeader, HelpCallout, NeedsStudent } from './ui';
import { helpSteps } from '../guideContent';

const CATEGORIES: ActivityCategory[] = ['Field Trip', 'Co-op Class', 'Sports', 'Music', 'Art', 'Community Service', 'Club', 'Competition', 'Other'];

const CATEGORY_TINT: Record<string, string> = {
  'Field Trip': 'bg-sky-100 text-sky-700',
  'Co-op Class': 'bg-indigo-100 text-indigo-700',
  Sports: 'bg-emerald-100 text-emerald-700',
  Music: 'bg-violet-100 text-violet-700',
  Art: 'bg-rose-100 text-rose-700',
  'Community Service': 'bg-amber-100 text-amber-700',
  Club: 'bg-teal-100 text-teal-700',
  Competition: 'bg-orange-100 text-orange-700',
  Other: 'bg-gray-100 text-gray-600',
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Activities({ onGoToStudents }: { onGoToStudents?: () => void }) {
  const { selectedStudent, activities, addActivity, deleteActivity } = useStudents();
  const [form, setForm] = useState({
    category: 'Field Trip' as ActivityCategory, date: todayKey(), title: '', location: '', hours: '',
    relatedSubjects: '', learningOutcomes: '', notes: ''
  });
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const studentActivities = useMemo(
    () => (selectedStudent ? activities.filter(a => a.studentId === selectedStudent.id).slice().sort((a, b) => b.date.localeCompare(a.date)) : []),
    [activities, selectedStudent]
  );

  const totals = useMemo(() => {
    const byCat = new Map<string, number>();
    let hours = 0;
    for (const a of studentActivities) {
      byCat.set(a.category, (byCat.get(a.category) || 0) + 1);
      hours += a.hours || 0;
    }
    return { count: studentActivities.length, hours, byCat: Array.from(byCat.entries()) };
  }, [studentActivities]);

  if (!selectedStudent) {
    return <NeedsStudent icon={Trophy} label="Activity logs document field trips, co-ops, sports, and service per student." onGoToStudents={onGoToStudents} />;
  }

  const add = () => {
    if (!form.title.trim()) return;
    const activity: Activity = {
      id: crypto.randomUUID(), studentId: selectedStudent.id, date: form.date,
      category: form.category, title: form.title.trim(), location: form.location.trim() || undefined,
      hours: form.hours ? Number(form.hours) : undefined,
      relatedSubjects: form.relatedSubjects.split(',').map(s => s.trim()).filter(Boolean),
      learningOutcomes: form.learningOutcomes.trim() || undefined, notes: form.notes.trim() || undefined
    };
    addActivity(activity);
    setForm({ category: form.category, date: todayKey(), title: '', location: '', hours: '', relatedSubjects: '', learningOutcomes: '', notes: '' });
  };

  const handleExport = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      await exportElementToPdf(reportRef.current, { filename: `${selectedStudent.name}-activities-${todayKey()}.pdf` });
    } finally {
      setIsExporting(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm";

  return (
    <div className="w-full space-y-6">
      <Panel>
        <SectionHeader icon={Trophy} title="Activities & Extracurriculars" subtitle={`Log outings and activities for ${selectedStudent.name}`} tint="amber" />
        <div className="mb-5"><HelpCallout id="activities" steps={helpSteps('activities')} /></div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Category</label>
            <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value as ActivityCategory }))} className={`mt-1 ${inputCls}`}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Date</label>
            <input type="date" value={form.date} max={todayKey()} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} className={`mt-1 ${inputCls}`} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-600">Title</label>
            <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Science museum trip — dinosaurs exhibit" className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Location</label>
            <input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Optional" className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Hours</label>
            <input type="number" min="0" step="0.5" value={form.hours} onChange={(e) => setForm(f => ({ ...f, hours: e.target.value }))} placeholder="e.g. 2" className={`mt-1 ${inputCls}`} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-600">Related subjects (comma-separated)</label>
            <input value={form.relatedSubjects} onChange={(e) => setForm(f => ({ ...f, relatedSubjects: e.target.value }))} placeholder="e.g. Science, History" className={`mt-1 ${inputCls}`} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-600">Learning outcomes</label>
            <textarea rows={2} value={form.learningOutcomes} onChange={(e) => setForm(f => ({ ...f, learningOutcomes: e.target.value }))} placeholder="What did they learn? How does this count toward their education?" className={`mt-1 ${inputCls} resize-none`} />
          </div>
        </div>
        <button onClick={add} disabled={!form.title.trim()}
          className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm disabled:opacity-50">
          <Plus className="w-5 h-5" /> Add activity
        </button>
      </Panel>

      <Panel delay={0.05}>
        <SectionHeader
          icon={BookMarked} title="Activity record" tint="emerald"
          subtitle={`${totals.count} activit${totals.count === 1 ? 'y' : 'ies'}${totals.hours ? ` · ${totals.hours} hours logged` : ''}`}
          action={studentActivities.length > 0 && (
            <button onClick={handleExport} disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-semibold disabled:opacity-50">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Export PDF
            </button>
          )}
        />
        {studentActivities.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">No activities logged yet. Add field trips, co-op classes, sports, and service above.</p>
        ) : (
          <div ref={reportRef} className="bg-white space-y-3">
            <div className="hidden print:block mb-2">
              <h1 className="text-xl font-bold">{selectedStudent.name} — Activity & Extracurricular Record</h1>
            </div>
            {studentActivities.map(a => (
              <div key={a.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${CATEGORY_TINT[a.category]}`}>{a.category}</span>
                      <span className="text-xs text-gray-400">{new Date(a.date + 'T00:00').toLocaleDateString()}</span>
                    </div>
                    <div className="font-semibold text-gray-900 mt-1">{a.title}</div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                      {a.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location}</span>}
                      {a.hours ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.hours}h</span> : null}
                      {a.relatedSubjects && a.relatedSubjects.length > 0 && <span>{a.relatedSubjects.join(', ')}</span>}
                    </div>
                    {a.learningOutcomes && <p className="text-sm text-gray-600 mt-2">{a.learningOutcomes}</p>}
                  </div>
                  <button onClick={() => deleteActivity(a.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 print:hidden">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
