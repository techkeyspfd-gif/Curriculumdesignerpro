import React from 'react';
import { Check } from 'lucide-react';
import { STUDENT_COLORS } from '../studentColors';

interface Props {
  value?: string;
  onChange: (colorId: string) => void;
}

export function ColorSwatchPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">Color Tag</label>
      <div className="flex flex-wrap gap-2">
        {STUDENT_COLORS.map(c => {
          const selected = value === c.id || (!value && c.id === STUDENT_COLORS[0].id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              title={c.label}
              aria-label={c.label}
              className={`w-9 h-9 rounded-full ${c.swatch} flex items-center justify-center transition-transform hover:scale-110 ${
                selected ? `ring-2 ring-offset-2 ${c.ring}` : ''
              }`}
            >
              {selected && <Check className="w-4 h-4 text-white" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
