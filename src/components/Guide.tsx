import React, { useState } from 'react';
import { motion } from 'motion/react';
import * as Icons from 'lucide-react';
import { LifeBuoy, Rocket, ChevronDown, Sparkles, HeartHandshake } from 'lucide-react';
import { GETTING_STARTED, GUIDE_SECTIONS } from '../guideContent';
import { Panel, SectionHeader } from './ui';

// Resolve a lucide icon by name from the guide content, falling back to a dot.
function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as any)[name] as Icons.LucideIcon | undefined;
  return Cmp ? <Cmp className={className} /> : <Icons.Circle className={className} />;
}

interface Props {
  onOpenTab?: (tabId: string) => void;
}

export function Guide({ onOpenTab }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="w-full space-y-6">
      {/* Intro */}
      <Panel>
        <SectionHeader
          icon={LifeBuoy}
          title="How to use Curriculum Pro"
          subtitle="A plain-English guide to every tool — start here if you're new."
          tint="violet"
        />
        <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Rocket className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-gray-900">Getting started in {GETTING_STARTED.length} steps</h3>
          </div>
          <ol className="space-y-3">
            {GETTING_STARTED.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span className="text-sm text-gray-700 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-5 flex items-start gap-3 text-sm text-gray-600 bg-amber-50/70 border border-amber-200 rounded-2xl p-4">
          <HeartHandshake className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold text-amber-900">Everything is personalized.</span> The more detail you put in each
            student's <span className="font-medium">learning needs</span> and <span className="font-medium">interests</span>, the
            better every lesson, quiz, and plan fits your child. You can edit those anytime in the Students tab.
          </p>
        </div>
      </Panel>

      {/* Per-feature accordion */}
      <Panel delay={0.05}>
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-bold text-gray-900">What every tab does</h3>
        </div>
        <div className="space-y-3">
          {GUIDE_SECTIONS.map((sec) => {
            const open = openId === sec.id;
            return (
              <div key={sec.id} className="rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setOpenId(open ? null : sec.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="shrink-0 p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <Icon name={sec.icon} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-gray-900">{sec.title}</div>
                    <div className="text-sm text-gray-500 truncate">{sec.tagline}</div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="px-5 pb-5"
                  >
                    <p className="text-sm text-gray-600 mb-4">{sec.what}</p>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">How to use it</div>
                    <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700 marker:text-indigo-400 marker:font-semibold mb-4">
                      {sec.steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                    {sec.tips && sec.tips.length > 0 && (
                      <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3 text-sm text-amber-900 space-y-1">
                        {sec.tips.map((t, i) => (
                          <p key={i} className="flex gap-2"><span className="text-amber-500">💡</span><span>{t}</span></p>
                        ))}
                      </div>
                    )}
                    {onOpenTab && (
                      <button
                        onClick={() => onOpenTab(sec.id)}
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        Open {sec.title} <Icons.ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
