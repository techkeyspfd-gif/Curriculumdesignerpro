import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Clock, Plus, Trash2, Save, CheckCircle2, Printer, Loader2, Users, CalendarDays, BarChart3, Timer } from 'lucide-react';
import { DailyLog, TimeLogEntry } from '../types';
import { useStudents } from '../StudentContext';
import { exportElementToPdf } from '../pdf';

// ---- date + time helpers (local time) ----
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayKey(): string { return dateKey(new Date()); }
function prettyDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
function formatMinutes(total: number): string {
  if (!total) return '0m';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ') || '0m';
}
function minutesBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(isNaN)) return null;
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : null;
}

const DEFAULT_SUBJECTS = ['Math', 'Science', 'Language Arts', 'Social Studies', 'Reading', 'Writing', 'Art', 'Music', 'PE', 'Field Trip', 'Lab', 'Special Project'];

interface Row { subject: string; hours: string; minutes: string; }

const emptyRow = (): Row => ({ subject: '', hours: '', minutes: '' });

export function TimeLog() {
  const { selectedStudent, dailyLogs, yearPlans, saveDailyLog, deleteDailyLog } = useStudents();

  const studentLogs = useMemo(
    () => (selectedStudent ? dailyLogs.filter(l => l.studentId === selectedStudent.id) : []),
    [dailyLogs, selectedStudent]
  );

  // Subject suggestions: this student's year-plan subjects + defaults + previously used.
  const subjectSuggestions = useMemo(() => {
    const set = new Set<string>(DEFAULT_SUBJECTS);
    if (selectedStudent) {
      yearPlans.filter(p => p.studentId === selectedStudent.id)
        .forEach(p => p.quarters.forEach(q => q.subjects.forEach(s => set.add(s.subject))));
    }
    studentLogs.forEach(l => l.entries.forEach(e => set.add(e.subject)));
    return Array.from(set);
  }, [selectedStudent, yearPlans, studentLogs]);

  // ---- entry form ----
  const [date, setDate] = useState(todayKey());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [notes, setNotes] = useState('');
  const [savedTick, setSavedTick] = useState(false);

  const existingLog = studentLogs.find(l => l.date === date);

  // Load the existing log for this student+date into the form whenever they change.
  useEffect(() => {
    if (existingLog) {
      setStartTime(existingLog.startTime || '');
      setEndTime(existingLog.endTime || '');
      setNotes(existingLog.notes || '');
      setRows(existingLog.entries.length
        ? existingLog.entries.map(e => ({ subject: e.subject, hours: String(Math.floor(e.minutes / 60) || ''), minutes: String(e.minutes % 60 || '') }))
        : [emptyRow()]);
    } else {
      setStartTime(''); setEndTime(''); setNotes(''); setRows([emptyRow()]);
    }
    setSavedTick(false);
  }, [date, selectedStudent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rowMinutes = (r: Row) => (parseInt(r.hours || '0', 10) || 0) * 60 + (parseInt(r.minutes || '0', 10) || 0);
  const formTotal = rows.reduce((sum, r) => sum + rowMinutes(r), 0);
  const dayLength = minutesBetween(startTime, endTime);

  const updateRow = (i: number, patch: Partial<Row>) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [emptyRow()]);

  const handleSave = () => {
    if (!selectedStudent) return;
    const entries: TimeLogEntry[] = rows
      .map(r => ({ subject: r.subject.trim(), minutes: rowMinutes(r) }))
      .filter(e => e.subject && e.minutes > 0);
    const log: DailyLog = {
      id: existingLog?.id ?? crypto.randomUUID(),
      studentId: selectedStudent.id,
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      entries,
      notes: notes.trim() || undefined
    };
    saveDailyLog(log);
    setSavedTick(true);
  };

  const handleDeleteDay = () => {
    if (existingLog && confirm(`Delete the log for ${prettyDate(date)}?`)) {
      deleteDailyLog(existingLog.id);
      setStartTime(''); setEndTime(''); setNotes(''); setRows([emptyRow()]);
    }
  };

  // ---- report / viewer ----
  const [viewMode, setViewMode] = useState<'day' | 'range'>('day');
  const [viewDate, setViewDate] = useState(todayKey());
  const [rangeStart, setRangeStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return dateKey(d); });
  const [rangeEnd, setRangeEnd] = useState(todayKey());
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const loggedDates = useMemo(() => studentLogs.map(l => l.date).sort((a, b) => b.localeCompare(a)), [studentLogs]);

  const setPreset = (preset: 'week' | 'month' | 'thirty') => {
    const end = new Date();
    const start = new Date();
    if (preset === 'week') start.setDate(end.getDate() - 6);
    else if (preset === 'thirty') start.setDate(end.getDate() - 29);
    else start.setDate(1);
    setRangeStart(dateKey(start));
    setRangeEnd(dateKey(end));
  };

  const logsInScope = useMemo(() => {
    if (viewMode === 'day') return studentLogs.filter(l => l.date === viewDate);
    const [lo, hi] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
    return studentLogs.filter(l => l.date >= lo && l.date <= hi).sort((a, b) => a.date.localeCompare(b.date));
  }, [viewMode, viewDate, rangeStart, rangeEnd, studentLogs]);

  const subjectTotals = useMemo(() => {
    const map = new Map<string, number>();
    logsInScope.forEach(l => l.entries.forEach(e => map.set(e.subject, (map.get(e.subject) || 0) + e.minutes)));
    return Array.from(map.entries()).map(([subject, minutes]) => ({ subject, minutes })).sort((a, b) => b.minutes - a.minutes);
  }, [logsInScope]);

  const grandTotal = subjectTotals.reduce((s, x) => s + x.minutes, 0);
  const maxSubject = subjectTotals[0]?.minutes || 1;

  const handleExport = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const label = viewMode === 'day' ? viewDate : `${rangeStart}_to_${rangeEnd}`;
      await exportElementToPdf(reportRef.current, { filename: `${selectedStudent!.name}-time-log-${label}.pdf` });
    } finally {
      setIsExporting(false);
    }
  };

  if (!selectedStudent) {
    return (
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-14 text-center text-gray-500">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 mb-5">
          <Clock className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Select a student first</h2>
        <p className="max-w-sm mx-auto">The Time Log tracks daily hours per subject for one student.<br />Choose or create a profile in the <span className="font-semibold">Students</span> tab.</p>
      </motion.div>
    );
  }

  return (
    <div className="w-full space-y-8">
      {/* ---- Daily entry ---- */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Clock className="w-6 h-6" /></div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Daily Time Log — {selectedStudent.name}</h2>
            <p className="text-gray-500 text-sm">Record hours per subject after school. One log per day; saving updates that day.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Date</label>
            <input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Day Start</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Day End</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
          </div>
        </div>

        <datalist id="subject-suggestions">
          {subjectSuggestions.map(s => <option key={s} value={s} />)}
        </datalist>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">Time per subject / activity</label>
            {existingLog && <span className="text-xs font-medium text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Editing saved log</span>}
          </div>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input list="subject-suggestions" placeholder="Subject or activity (e.g. Math, Field Trip)" value={r.subject}
                onChange={(e) => updateRow(i, { subject: e.target.value })}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
              <input type="number" min="0" placeholder="h" value={r.hours} onChange={(e) => updateRow(i, { hours: e.target.value })}
                className="w-16 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-center" />
              <span className="text-gray-400 text-sm">h</span>
              <input type="number" min="0" max="59" placeholder="m" value={r.minutes} onChange={(e) => updateRow(i, { minutes: e.target.value })}
                className="w-16 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-center" />
              <span className="text-gray-400 text-sm">m</span>
              <button onClick={() => removeRow(i)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove row">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors text-sm font-semibold">
            <Plus className="w-4 h-4" /> Add subject / activity
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-semibold text-gray-700">Notes (optional)</label>
          <textarea rows={2} placeholder="e.g. Field trip to the science museum; short day due to appointment." value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none" />
        </div>

        <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">Total logged: {formatMinutes(formTotal)}</span>
            {dayLength !== null && <span className="text-gray-400"> · Day span {formatMinutes(dayLength)}</span>}
          </div>
          <div className="flex items-center gap-3">
            {existingLog && (
              <button onClick={handleDeleteDay} className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-semibold">
                <Trash2 className="w-4 h-4" /> Delete day
              </button>
            )}
            <button onClick={handleSave} disabled={formTotal === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {savedTick ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              {savedTick ? 'Saved' : 'Save Log'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* ---- Report / viewer ---- */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><BarChart3 className="w-6 h-6" /></div>
            <h2 className="text-2xl font-bold text-gray-900">Time Report</h2>
          </div>
          {grandTotal > 0 && (
            <button onClick={handleExport} disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-semibold disabled:opacity-50">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Export PDF
            </button>
          )}
        </div>

        {/* mode toggle */}
        <div className="inline-flex bg-gray-100/80 p-1 rounded-2xl border border-gray-200 shadow-inner gap-1 mb-6">
          <button onClick={() => setViewMode('day')} className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === 'day' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Single Date</button>
          <button onClick={() => setViewMode('range')} className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === 'range' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Date Range</button>
        </div>

        {/* selectors */}
        {viewMode === 'day' ? (
          <div className="flex items-center gap-3 flex-wrap mb-6">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-gray-400" /> Date</label>
            <input type="date" value={viewDate} max={todayKey()} onChange={(e) => setViewDate(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
            {loggedDates.length > 0 && (
              <select value={loggedDates.includes(viewDate) ? viewDate : ''} onChange={(e) => e.target.value && setViewDate(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm">
                <option value="">Jump to a logged day…</option>
                {loggedDates.map(d => <option key={d} value={d}>{prettyDate(d)}</option>)}
              </select>
            )}
          </div>
        ) : (
          <div className="flex items-end gap-3 flex-wrap mb-6">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">From</label>
              <input type="date" value={rangeStart} max={todayKey()} onChange={(e) => setRangeStart(e.target.value)}
                className="block px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">To</label>
              <input type="date" value={rangeEnd} max={todayKey()} onChange={(e) => setRangeEnd(e.target.value)}
                className="block px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreset('week')} className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors">This Week</button>
              <button onClick={() => setPreset('month')} className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors">This Month</button>
              <button onClick={() => setPreset('thirty')} className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors">Last 30 Days</button>
            </div>
          </div>
        )}

        {/* report body (also the PDF export target) */}
        <div ref={reportRef} className="bg-white">
          <div className="mb-5">
            <h3 className="text-lg font-bold text-gray-900">
              {selectedStudent.name} — {viewMode === 'day' ? prettyDate(viewDate) : `${prettyDate(rangeStart)} → ${prettyDate(rangeEnd)}`}
            </h3>
            <p className="text-sm text-gray-500">
              {viewMode === 'range' && `${logsInScope.length} day${logsInScope.length === 1 ? '' : 's'} logged · `}
              Total instructional time: <span className="font-semibold text-gray-800">{formatMinutes(grandTotal)}</span>
            </p>
          </div>

          {grandTotal === 0 ? (
            <p className="text-gray-500 text-sm py-6">No time logged for this {viewMode === 'day' ? 'day' : 'range'} yet.</p>
          ) : (
            <>
              {/* per-subject breakdown */}
              <div className="space-y-3">
                {subjectTotals.map(({ subject, minutes }) => (
                  <div key={subject}>
                    <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                      <span>{subject}</span>
                      <span>{formatMinutes(minutes)} · {Math.round((minutes / grandTotal) * 100)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round((minutes / maxSubject) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* single-day extras */}
              {viewMode === 'day' && logsInScope[0] && (logsInScope[0].startTime || logsInScope[0].notes) && (
                <div className="mt-5 pt-4 border-t border-gray-100 text-sm text-gray-600 space-y-1">
                  {logsInScope[0].startTime && logsInScope[0].endTime && (
                    <p className="flex items-center gap-2"><Timer className="w-4 h-4 text-gray-400" /> School day: {logsInScope[0].startTime}–{logsInScope[0].endTime}</p>
                  )}
                  {logsInScope[0].notes && <p className="italic">“{logsInScope[0].notes}”</p>}
                </div>
              )}

              {/* range: per-day table */}
              {viewMode === 'range' && (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Subjects</th>
                        <th className="py-2 pr-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsInScope.map(l => {
                        const dayTotal = l.entries.reduce((s, e) => s + e.minutes, 0);
                        return (
                          <tr key={l.id} className="border-b border-gray-100 text-gray-700 align-top">
                            <td className="py-2.5 pr-4 whitespace-nowrap font-medium text-gray-900">{prettyDate(l.date)}</td>
                            <td className="py-2.5 pr-4">{l.entries.map(e => `${e.subject} (${formatMinutes(e.minutes)})`).join(', ')}</td>
                            <td className="py-2.5 pr-4 text-right whitespace-nowrap font-semibold">{formatMinutes(dayTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
