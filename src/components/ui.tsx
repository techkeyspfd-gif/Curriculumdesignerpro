import React, { useState, ReactNode } from 'react';
import { motion } from 'motion/react';
import { LucideIcon, Lightbulb, ChevronDown, UserPlus } from 'lucide-react';

// A white rounded panel matching the app's card style.
export function Panel({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay }}
      className={`bg-white rounded-3xl shadow-sm border border-gray-100 p-8 ${className}`}
    >
      {children}
    </motion.div>
  );
}

// Icon + title + subtitle header used at the top of feature panels.
export function SectionHeader({ icon: Icon, title, subtitle, tint = 'indigo', action }: {
  icon: LucideIcon; title: string; subtitle?: string; tint?: string; action?: ReactNode;
}) {
  const tints: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
  };
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-xl ${tints[tint] || tints.indigo}`}><Icon className="w-6 h-6" /></div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-gray-500 text-sm">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// Shown when a feature needs a selected student but none is chosen.
export function NeedsStudent({ icon: Icon, label, onGoToStudents }: { icon: LucideIcon; label: string; onGoToStudents?: () => void }) {
  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="bg-white rounded-3xl shadow-sm border border-gray-100 p-14 text-center text-gray-500">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 mb-5">
        <Icon className="w-8 h-8 text-indigo-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Select a student first</h2>
      <p className="max-w-sm mx-auto mb-5">{label}</p>
      {onGoToStudents && (
        <button onClick={onGoToStudents}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm">
          <UserPlus className="w-4 h-4" /> Go to Students
        </button>
      )}
    </motion.div>
  );
}

// Collapsible "how to use this" instructional callout. Remembers its
// open/closed state per id so a parent isn't nagged after they dismiss it.
export function HelpCallout({ id, title = 'How to use this', steps, children, defaultOpen }: {
  id: string; title?: string; steps?: string[]; children?: ReactNode; defaultOpen?: boolean;
}) {
  const storageKey = `help-open:${id}`;
  const [open, setOpen] = useState<boolean>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (saved !== null) return saved === 'true';
    return defaultOpen ?? true;
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(storageKey, String(next)); } catch { /* ignore */ }
  };
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 overflow-hidden print:hidden">
      <button onClick={toggle} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex items-center gap-2 font-semibold text-amber-900">
          <Lightbulb className="w-4 h-4 text-amber-500" /> {title}
        </span>
        <ChevronDown className={`w-4 h-4 text-amber-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-amber-900/90">
          {steps && (
            <ol className="list-decimal list-inside space-y-1.5 marker:text-amber-500 marker:font-semibold">
              {steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

// Simple horizontal bar for lightweight charts (mastery, coverage, trends).
export function Bar({ value, max, color = 'bg-indigo-500', track = 'bg-gray-100' }: { value: number; max: number; color?: string; track?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={`w-full h-2.5 rounded-full overflow-hidden ${track}`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
