// A small curated palette for student color tags. Each entry provides the
// Tailwind classes needed everywhere a student's color shows up: a solid
// swatch/avatar treatment, a soft badge, and a left accent bar for cards.
export interface StudentColor {
  id: string;
  label: string;
  swatch: string;      // solid background, for avatars/dots
  badgeBg: string;      // soft background for pill badges
  badgeText: string;
  accentBorder: string; // left border accent for cards
  ring: string;         // selected-state ring
}

export const STUDENT_COLORS: StudentColor[] = [
  { id: 'indigo',  label: 'Indigo',  swatch: 'bg-indigo-500',  badgeBg: 'bg-indigo-50',  badgeText: 'text-indigo-700',  accentBorder: 'border-l-indigo-400',  ring: 'ring-indigo-400' },
  { id: 'emerald', label: 'Emerald', swatch: 'bg-emerald-500', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-700', accentBorder: 'border-l-emerald-400', ring: 'ring-emerald-400' },
  { id: 'amber',   label: 'Amber',   swatch: 'bg-amber-500',   badgeBg: 'bg-amber-50',   badgeText: 'text-amber-700',   accentBorder: 'border-l-amber-400',   ring: 'ring-amber-400' },
  { id: 'rose',    label: 'Rose',    swatch: 'bg-rose-500',    badgeBg: 'bg-rose-50',    badgeText: 'text-rose-700',    accentBorder: 'border-l-rose-400',    ring: 'ring-rose-400' },
  { id: 'sky',     label: 'Sky',     swatch: 'bg-sky-500',     badgeBg: 'bg-sky-50',     badgeText: 'text-sky-700',     accentBorder: 'border-l-sky-400',     ring: 'ring-sky-400' },
  { id: 'violet',  label: 'Violet',  swatch: 'bg-violet-500',  badgeBg: 'bg-violet-50',  badgeText: 'text-violet-700',  accentBorder: 'border-l-violet-400',  ring: 'ring-violet-400' },
  { id: 'teal',    label: 'Teal',    swatch: 'bg-teal-500',    badgeBg: 'bg-teal-50',    badgeText: 'text-teal-700',    accentBorder: 'border-l-teal-400',    ring: 'ring-teal-400' },
  { id: 'orange',  label: 'Orange',  swatch: 'bg-orange-500',  badgeBg: 'bg-orange-50',  badgeText: 'text-orange-700',  accentBorder: 'border-l-orange-400',  ring: 'ring-orange-400' },
];

const DEFAULT_COLOR = STUDENT_COLORS[0];

export function getStudentColor(colorId?: string): StudentColor {
  return STUDENT_COLORS.find(c => c.id === colorId) ?? DEFAULT_COLOR;
}

// Deterministic fallback so students created before this feature (or without
// an explicit choice) still get a stable, distinct-ish color instead of all
// defaulting to indigo.
export function colorForStudentId(id: string): StudentColor {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return STUDENT_COLORS[hash % STUDENT_COLORS.length];
}
