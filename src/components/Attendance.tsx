import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarCheck, ChevronLeft, ChevronRight, Printer, Loader2, Settings2, ShieldCheck } from 'lucide-react';
import { AttendanceStatus, ComplianceSettings } from '../types';
import { useStudents } from '../StudentContext';
import { exportElementToPdf } from '../pdf';
import { Panel, SectionHeader, HelpCallout, NeedsStudent, Bar } from './ui';
import { helpSteps } from '../guideContent';

const STATUS_CYCLE: (AttendanceStatus | 'clear')[] = ['present', 'partial', 'absent', 'holiday', 'clear'];
const STATUS_META: Record<AttendanceStatus, { label: string; cls: string; dot: string; dayValue: number }> = {
  present: { label: 'Present', cls: 'bg-emerald-500 text-white', dot: 'bg-emerald-500', dayValue: 1 },
  partial: { label: 'Partial', cls: 'bg-amber-400 text-white', dot: 'bg-amber-400', dayValue: 0.5 },
  absent: { label: 'Absent', cls: 'bg-red-400 text-white', dot: 'bg-red-400', dayValue: 0 },
  holiday: { label: 'Holiday', cls: 'bg-gray-300 text-gray-700', dot: 'bg-gray-300', dayValue: 0 },
};

function pad(n: number) { return String(n).padStart(2, '0'); }
function keyOf(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function todayKey() { const d = new Date(); return keyOf(d.getFullYear(), d.getMonth(), d.getDate()); }

// Default US-ish requirement suggestions parents can adopt or override.
const STATE_PRESETS: Record<string, { requiredDays?: number; requiredHours?: number }> = {
  'Not set': {},
  'Generic (180 days)': { requiredDays: 180 },
  'Hours-based (1000 hrs)': { requiredHours: 1000 },
  'Texas': {}, 'Florida (180 days)': { requiredDays: 180 },
  'New York (900–990 hrs)': { requiredHours: 990 }, 'Ohio (900 hrs)': { requiredHours: 900 },
  'Pennsylvania (180 days)': { requiredDays: 180 }, 'Washington (1000 hrs)': { requiredHours: 1000 },
};

export function Attendance({ onGoToStudents }: { onGoToStudents?: () => void }) {
  const { selectedStudent, updateStudent, attendance, setAttendanceMark, deleteAttendanceMark, dailyLogs } = useStudents();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [showSettings, setShowSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const marks = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    if (selectedStudent) attendance.filter(a => a.studentId === selectedStudent.id).forEach(a => map.set(a.date, a.status));
    return map;
  }, [attendance, selectedStudent]);

  const compliance: ComplianceSettings = selectedStudent?.compliance || {};

  const stats = useMemo(() => {
    if (!selectedStudent) return { days: 0, hours: 0, present: 0, partial: 0, absent: 0 };
    const inRange = (date: string) => {
      if (compliance.schoolYearStart && date < compliance.schoolYearStart) return false;
      if (compliance.schoolYearEnd && date > compliance.schoolYearEnd) return false;
      return true;
    };
    let days = 0, present = 0, partial = 0, absent = 0;
    for (const a of attendance.filter(a => a.studentId === selectedStudent.id)) {
      if (!inRange(a.date)) continue;
      days += STATUS_META[a.status].dayValue;
      if (a.status === 'present') present++;
      else if (a.status === 'partial') partial++;
      else if (a.status === 'absent') absent++;
    }
    let minutes = 0;
    for (const l of dailyLogs.filter(l => l.studentId === selectedStudent.id)) {
      if (!inRange(l.date)) continue;
      minutes += l.entries.reduce((s, e) => s + e.minutes, 0);
    }
    return { days, hours: Math.round(minutes / 60 * 10) / 10, present, partial, absent };
  }, [attendance, dailyLogs, selectedStudent, compliance.schoolYearStart, compliance.schoolYearEnd]);

  if (!selectedStudent) {
    return <NeedsStudent icon={CalendarCheck} label="Attendance and compliance are tracked per student against your state's requirements." onGoToStudents={onGoToStudents} />;
  }

  const cycleDay = (dateKey: string) => {
    const current = marks.get(dateKey);
    const idx = current ? STATUS_CYCLE.indexOf(current) : -1;
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    if (next === 'clear') deleteAttendanceMark(selectedStudent.id, dateKey);
    else setAttendanceMark({ id: crypto.randomUUID(), studentId: selectedStudent.id, date: dateKey, status: next });
  };

  const setCompliance = (updates: Partial<ComplianceSettings>) => {
    updateStudent(selectedStudent.id, { compliance: { ...compliance, ...updates } });
  };

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const daysPct = compliance.requiredDays ? Math.min(100, Math.round((stats.days / compliance.requiredDays) * 100)) : null;
  const hoursPct = compliance.requiredHours ? Math.min(100, Math.round((stats.hours / compliance.requiredHours) * 100)) : null;

  const handleExport = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try { await exportElementToPdf(reportRef.current, { filename: `${selectedStudent.name}-compliance-${todayKey()}.pdf` }); }
    finally { setIsExporting(false); }
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm";

  return (
    <div className="w-full space-y-6">
      <Panel>
        <SectionHeader icon={CalendarCheck} title="Attendance & Compliance" subtitle={`Track school days and hours for ${selectedStudent.name}`} tint="emerald"
          action={
            <button onClick={() => setShowSettings(s => !s)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-semibold">
              <Settings2 className="w-4 h-4" /> Requirements
            </button>
          }
        />
        <div className="mb-5"><HelpCallout id="attendance" steps={helpSteps('attendance')} /></div>

        {showSettings && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">State preset</label>
                <select className={`mt-1 ${inputCls}`} value={compliance.state || 'Not set'}
                  onChange={(e) => { const p = STATE_PRESETS[e.target.value] || {}; setCompliance({ state: e.target.value, ...p }); }}>
                  {Object.keys(STATE_PRESETS).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Required days</label>
                  <input type="number" className={`mt-1 ${inputCls}`} value={compliance.requiredDays ?? ''} onChange={(e) => setCompliance({ requiredDays: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Required hours</label>
                  <input type="number" className={`mt-1 ${inputCls}`} value={compliance.requiredHours ?? ''} onChange={(e) => setCompliance({ requiredHours: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">School year start</label>
                <input type="date" className={`mt-1 ${inputCls}`} value={compliance.schoolYearStart || ''} onChange={(e) => setCompliance({ schoolYearStart: e.target.value || undefined })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">School year end</label>
                <input type="date" className={`mt-1 ${inputCls}`} value={compliance.schoolYearEnd || ''} onChange={(e) => setCompliance({ schoolYearEnd: e.target.value || undefined })} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Requirements vary by state — always confirm your state's exact rules. Presets are starting points, not legal advice.</p>
          </motion.div>
        )}

        {/* Calendar */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft className="w-5 h-5" /></button>
          <h3 className="font-bold text-gray-900">{monthLabel}</h3>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const dk = keyOf(year, month, day);
            const status = marks.get(dk);
            const isToday = dk === todayKey();
            return (
              <button key={i} onClick={() => cycleDay(dk)}
                className={`aspect-square rounded-lg text-sm font-semibold flex items-center justify-center transition-all border ${status ? STATUS_META[status].cls + ' border-transparent' : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'} ${isToday ? 'ring-2 ring-indigo-400' : ''}`}
                title={status ? STATUS_META[status].label : 'Click to mark present'}>
                {day}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-500">
          {(Object.keys(STATUS_META) as AttendanceStatus[]).map(s => (
            <span key={s} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded ${STATUS_META[s].dot}`} />{STATUS_META[s].label}</span>
          ))}
          <span className="text-gray-400">· Click a day to cycle status</span>
        </div>
      </Panel>

      {/* Compliance dashboard / report */}
      <Panel delay={0.05}>
        <SectionHeader icon={ShieldCheck} title="Compliance dashboard" tint="indigo"
          action={
            <button onClick={handleExport} disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-semibold disabled:opacity-50">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Export report
            </button>
          }
        />
        <div ref={reportRef} className="bg-white space-y-5">
          <div className="hidden print:block">
            <h1 className="text-xl font-bold">{selectedStudent.name} — Attendance & Compliance Report</h1>
            <p className="text-sm text-gray-600">Generated {new Date().toLocaleDateString()}{compliance.state && compliance.state !== 'Not set' ? ` · ${compliance.state}` : ''}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.days}</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">Days completed</div>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.hours}</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">Hours logged</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
              <div className="text-2xl font-bold text-emerald-600">{stats.present}</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">Present</div>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.partial}</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">Partial</div>
            </div>
          </div>

          {daysPct !== null && (
            <div>
              <div className="flex justify-between text-sm font-medium text-gray-700 mb-1"><span>Days progress</span><span>{stats.days} / {compliance.requiredDays} ({daysPct}%)</span></div>
              <Bar value={stats.days} max={compliance.requiredDays!} color="bg-emerald-500" />
            </div>
          )}
          {hoursPct !== null && (
            <div>
              <div className="flex justify-between text-sm font-medium text-gray-700 mb-1"><span>Hours progress</span><span>{stats.hours} / {compliance.requiredHours} ({hoursPct}%)</span></div>
              <Bar value={stats.hours} max={compliance.requiredHours!} color="bg-indigo-500" />
            </div>
          )}
          {daysPct === null && hoursPct === null && (
            <p className="text-sm text-gray-500">Set your state's required days or hours under <span className="font-semibold">Requirements</span> to see progress toward compliance.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
