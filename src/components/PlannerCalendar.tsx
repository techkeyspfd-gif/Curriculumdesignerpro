import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2, Circle, AlertTriangle, Clock, Wand2, BookOpen } from 'lucide-react';
import { Assignment, AssignmentStatus, PlanSource } from '../types';
import { useStudents } from '../StudentContext';
import { Panel, SectionHeader, HelpCallout, NeedsStudent } from './ui';
import { helpSteps } from '../guideContent';

function pad(n: number) { return String(n).padStart(2, '0'); }
function keyOf(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function todayKey() { const d = new Date(); return keyOf(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return keyOf(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function prettyDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const STATUS_NEXT: Record<AssignmentStatus, AssignmentStatus> = { todo: 'in_progress', in_progress: 'done', done: 'todo' };

export function PlannerCalendar({ onGoToStudents, onOpenLesson }: { onGoToStudents?: () => void; onOpenLesson?: (lessonId: string) => void }) {
  const { selectedStudent, assignments, addAssignment, updateAssignment, deleteAssignment, yearPlans, lessons } = useStudents();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [form, setForm] = useState({ title: '', subject: '', dueDate: todayKey() });

  const studentAssignments = useMemo(
    () => (selectedStudent ? assignments.filter(a => a.studentId === selectedStudent.id) : []),
    [assignments, selectedStudent]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of studentAssignments) {
      const arr = map.get(a.dueDate) || [];
      arr.push(a); map.set(a.dueDate, arr);
    }
    return map;
  }, [studentAssignments]);

  const tk = todayKey();
  const overdue = studentAssignments.filter(a => a.status !== 'done' && a.dueDate < tk).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcoming = studentAssignments.filter(a => a.status !== 'done' && a.dueDate >= tk && a.dueDate <= addDays(tk, 7)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (!selectedStudent) {
    return <NeedsStudent icon={CalendarClock} label="Assignments and due dates are tracked per student." onGoToStudents={onGoToStudents} />;
  }

  const add = () => {
    if (!form.title.trim()) return;
    addAssignment({
      id: crypto.randomUUID(), studentId: selectedStudent.id, title: form.title.trim(),
      subject: form.subject.trim() || undefined, dueDate: form.dueDate, status: 'todo', createdDate: new Date().toISOString()
    });
    setForm({ title: '', subject: '', dueDate: form.dueDate });
  };

  // Schedule the next incomplete year-plan weeks as weekly assignments.
  const fillFromYearPlan = () => {
    const plan = yearPlans.find(p => p.studentId === selectedStudent.id);
    if (!plan) return;
    const existingSources = new Set(
      studentAssignments.filter(a => a.source).map(a => `${a.source!.quarterIndex}-${a.source!.subjectIndex}-${a.source!.weekIndex}`)
    );
    const toAdd: Assignment[] = [];
    let dueCursor = tk;
    let scheduled = 0;
    outer:
    for (let qi = 0; qi < plan.quarters.length; qi++) {
      const quarter = plan.quarters[qi];
      for (let si = 0; si < quarter.subjects.length; si++) {
        const subj = quarter.subjects[si];
        for (let wi = 0; wi < subj.weekly_plan.length; wi++) {
          const week = subj.weekly_plan[wi];
          if (week.completed) continue;
          const src: PlanSource = { yearPlanId: plan.id, quarterIndex: qi, subjectIndex: si, weekIndex: wi };
          const sig = `${qi}-${si}-${wi}`;
          if (existingSources.has(sig)) continue;
          toAdd.push({
            id: crypto.randomUUID(), studentId: selectedStudent.id, title: `${subj.subject}: ${week.topic}`,
            subject: subj.subject, dueDate: dueCursor, status: 'todo', source: src, createdDate: new Date().toISOString()
          });
          dueCursor = addDays(dueCursor, 4); // roughly spread across the week
          if (++scheduled >= 12) break outer;
        }
      }
    }
    toAdd.reverse().forEach(addAssignment);
  };

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const linkedLesson = (a: Assignment) => a.lessonId ? lessons.find(l => l.id === a.lessonId) : undefined;

  const AssignmentRow = ({ a }: { a: Assignment }) => {
    const lesson = linkedLesson(a);
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white">
        <button onClick={() => updateAssignment(a.id, { status: STATUS_NEXT[a.status] })} className="shrink-0" title="Cycle status">
          {a.status === 'done' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            : a.status === 'in_progress' ? <Clock className="w-5 h-5 text-amber-500" />
            : <Circle className="w-5 h-5 text-gray-300" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`font-medium text-sm ${a.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{a.title}</div>
          <div className="text-xs text-gray-500">{a.subject ? `${a.subject} · ` : ''}Due {prettyDate(a.dueDate)}</div>
        </div>
        {lesson && onOpenLesson && (
          <button onClick={() => onOpenLesson(lesson.id)} className="shrink-0 text-indigo-600 hover:text-indigo-700 p-1.5 rounded-lg hover:bg-indigo-50" title="Open lesson">
            <BookOpen className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => deleteAssignment(a.id)} className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const inputCls = "px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm";

  return (
    <div className="w-full space-y-6">
      <Panel>
        <SectionHeader icon={CalendarClock} title="Planner & Due Dates" subtitle={`Assignments and deadlines for ${selectedStudent.name}`} tint="indigo" />
        <div className="mb-5"><HelpCallout id="calendar" steps={helpSteps('calendar')} /></div>

        {/* reminders */}
        {(overdue.length > 0 || upcoming.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {overdue.length > 0 && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-2"><AlertTriangle className="w-4 h-4" /> Overdue ({overdue.length})</div>
                <div className="space-y-2">{overdue.slice(0, 4).map(a => <AssignmentRow key={a.id} a={a} />)}</div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-2"><Clock className="w-4 h-4" /> Due in the next 7 days ({upcoming.length})</div>
                <div className="space-y-2">{upcoming.slice(0, 4).map(a => <AssignmentRow key={a.id} a={a} />)}</div>
              </div>
            )}
          </div>
        )}

        {/* add form */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-600">Assignment</label>
            <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="e.g. Chapter 4 reading response" className={`block mt-1 w-full ${inputCls}`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Subject</label>
            <input value={form.subject} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Optional" className={`block mt-1 w-36 ${inputCls}`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Due</label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} className={`block mt-1 ${inputCls}`} />
          </div>
          <button onClick={add} disabled={!form.title.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm disabled:opacity-50">
            <Plus className="w-5 h-5" /> Add
          </button>
          {yearPlans.some(p => p.studentId === selectedStudent.id) && (
            <button onClick={fillFromYearPlan} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-50 transition-colors font-semibold shadow-sm text-sm">
              <Wand2 className="w-4 h-4" /> Fill from year plan
            </button>
          )}
        </div>
      </Panel>

      {/* month calendar */}
      <Panel delay={0.05}>
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
            const items = byDate.get(dk) || [];
            const isToday = dk === tk;
            return (
              <div key={i} className={`min-h-[70px] rounded-lg border p-1.5 ${isToday ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-100'}`}>
                <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>{day}</div>
                <div className="space-y-1">
                  {items.slice(0, 3).map(a => (
                    <div key={a.id} className={`text-[10px] leading-tight px-1.5 py-0.5 rounded truncate ${a.status === 'done' ? 'bg-emerald-100 text-emerald-700 line-through' : a.dueDate < tk ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`} title={a.title}>
                      {a.title}
                    </div>
                  ))}
                  {items.length > 3 && <div className="text-[10px] text-gray-400 px-1">+{items.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* full list */}
      {studentAssignments.length > 0 && (
        <Panel delay={0.1}>
          <h3 className="text-lg font-bold text-gray-900 mb-4">All assignments</h3>
          <div className="space-y-2">
            {studentAssignments.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(a => <AssignmentRow key={a.id} a={a} />)}
          </div>
        </Panel>
      )}
    </div>
  );
}
