import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Curriculum, LessonResults, RegenSection, Score } from '../types';
import { BookOpen, FileText, CheckSquare, Home, Presentation, Printer, Activity, HelpCircle, List, Loader2, X, Link, Video, Book, RefreshCw, ClipboardCheck, CheckCircle2, Pencil, Focus, ChevronLeft, ChevronRight, LayoutList } from 'lucide-react';
import { motion } from 'motion/react';
import { exportElementToPdf } from '../pdf';

interface Props {
  curriculum: Curriculum;
  title?: string;
  subtitle?: string;
  studentName?: string;
  results?: LessonResults;
  onSaveResults?: (results: LessonResults) => void;
  onRegenerateSection?: (section: RegenSection, instruction: string) => Promise<void>;
}

function parseScore(correct: string, total: string): Score | undefined {
  const c = parseInt(correct, 10);
  const t = parseInt(total, 10);
  if (isNaN(c) || isNaN(t) || t <= 0 || c < 0 || c > t) return undefined;
  return { correct: c, total: t };
}

// Ruled lines for students to hand-write answers on the printed worksheet.
function AnswerLines({ count }: { count: number }) {
  return (
    <div className="mt-4 space-y-7">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-b border-gray-300" />
      ))}
    </div>
  );
}

function answerLineCount(type: string): number {
  if (type === 'essay') return 8;
  if (type === 'short_answer') return 3;
  return 0;
}

export function CurriculumDisplay({ curriculum, title, subtitle, studentName, results, onSaveResults, onRegenerateSection }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const printContentRef = useRef<HTMLDivElement>(null);

  const [regenerating, setRegenerating] = useState<RegenSection | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  // Focus Mode: a calmer, one-section-at-a-time view for students who do
  // better with less visual density and a predictable, linear structure.
  const [focusMode, setFocusMode] = useState(() => localStorage.getItem('focusModePreferred') === 'true');
  const [focusStep, setFocusStep] = useState(0);
  const toggleFocusMode = () => {
    setFocusMode(prev => {
      const next = !prev;
      localStorage.setItem('focusModePreferred', String(next));
      return next;
    });
    setFocusStep(0);
  };

  const isCompleted = !!results?.completedDate;
  const [editingResults, setEditingResults] = useState(false);
  const [wsCorrect, setWsCorrect] = useState(results?.worksheetScore ? String(results.worksheetScore.correct) : '');
  const [wsTotal, setWsTotal] = useState(results?.worksheetScore ? String(results.worksheetScore.total) : String(curriculum.worksheet.length));
  const [quizCorrect, setQuizCorrect] = useState(results?.quizScore ? String(results.quizScore.correct) : '');
  const [quizTotal, setQuizTotal] = useState(results?.quizScore ? String(results.quizScore.total) : String(curriculum.formative_assessment?.length ?? 3));
  const [resultNotes, setResultNotes] = useState(results?.notes || '');

  const handleSaveResults = () => {
    if (!onSaveResults) return;
    onSaveResults({
      completedDate: results?.completedDate ?? new Date().toISOString(),
      worksheetScore: parseScore(wsCorrect, wsTotal),
      quizScore: parseScore(quizCorrect, quizTotal),
      notes: resultNotes.trim() || undefined
    });
    setEditingResults(false);
  };

  const handleRegen = async (section: RegenSection, instruction: string) => {
    if (!onRegenerateSection || regenerating) return;
    setRegenerating(section);
    setRegenError(null);
    try {
      await onRegenerateSection(section, instruction);
    } catch (e: any) {
      setRegenError(e.message || 'Failed to regenerate this section');
    } finally {
      setRegenerating(null);
    }
  };

  const regenButton = (section: RegenSection, instruction: string, label: string) => (
    <button
      onClick={() => handleRegen(section, instruction)}
      disabled={regenerating !== null}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg hover:bg-white hover:text-indigo-700 hover:border-indigo-200 transition-colors text-xs font-semibold disabled:opacity-50"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${regenerating === section ? 'animate-spin' : ''}`} />
      {label}
    </button>
  );

  const handleExportPDF = async () => {
    if (!printContentRef.current) return;
    setIsExporting(true);
    const slug = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : '';
    try {
      await exportElementToPdf(printContentRef.current, {
        filename: slug ? `${slug}.pdf` : 'lesson_material.pdf',
        footerText: packetLabel || undefined
      });
    } finally {
      setIsExporting(false);
    }
  };

  const renderResourceIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('video') || t.includes('youtube')) return <Video className="w-5 h-5" />;
    if (t.includes('book')) return <Book className="w-5 h-5" />;
    return <Link className="w-5 h-5" />;
  };

  interface FocusStep {
    key: string;
    label: string;
    icon: React.ReactNode;
    content: React.ReactNode;
  }

  const focusSteps: FocusStep[] = [
    {
      key: 'reading',
      label: 'Reading Material',
      icon: <BookOpen className="w-6 h-6" />,
      content: (
        <>
          {curriculum.readability_score && (
            <div className="mb-6 text-sm text-gray-400 font-medium">{curriculum.readability_score}</div>
          )}
          <div className="prose prose-slate prose-lg max-w-none text-gray-700 whitespace-pre-wrap leading-loose">
            {curriculum.reading_material}
          </div>
        </>
      )
    },
    ...(curriculum.glossary && curriculum.glossary.length > 0 ? [{
      key: 'glossary',
      label: 'Vocabulary',
      icon: <List className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          {curriculum.glossary.map((term, idx) => (
            <div key={idx} className="p-5 rounded-xl bg-gray-50 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-1 text-lg">{term.word}</h3>
              <p className="text-gray-600">{term.definition}</p>
            </div>
          ))}
        </div>
      )
    }] : []),
    {
      key: 'worksheet',
      label: 'Worksheet',
      icon: <CheckSquare className="w-6 h-6" />,
      content: (
        <div className="space-y-6">
          {onRegenerateSection && (
            <div className="flex gap-2 print:hidden">
              {regenButton('worksheet', 'Make the questions noticeably easier and more scaffolded (add hints, simpler wording, more multiple choice).', 'Easier')}
              {regenButton('worksheet', 'Make the questions noticeably more challenging (more analysis, fewer multiple choice, deeper reasoning).', 'Harder')}
            </div>
          )}
          {curriculum.worksheet.map((q, idx) => (
            <div key={idx} className="p-5 rounded-xl bg-gray-50 border border-gray-100">
              <p className="font-semibold text-gray-900 mb-3 text-lg">{idx + 1}. {q.question}</p>
              {q.type === 'multiple_choice' && q.options && q.options.length > 0 && (
                <ul className="space-y-2">
                  {q.options.map((opt, oIdx) => (
                    <li key={oIdx} className="flex items-start gap-2 text-gray-700">
                      <span className="inline-block w-6 h-6 rounded-full border border-gray-300 text-center text-sm leading-5 font-medium shrink-0 bg-white">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span>{opt}</span>
                    </li>
                  ))}
                </ul>
              )}
              {answerLineCount(q.type) > 0 && <AnswerLines count={answerLineCount(q.type)} />}
            </div>
          ))}
        </div>
      )
    },
    ...(curriculum.formative_assessment && curriculum.formative_assessment.length > 0 ? [{
      key: 'quiz',
      label: 'Quiz',
      icon: <HelpCircle className="w-6 h-6" />,
      content: (
        <div className="space-y-6">
          {onRegenerateSection && (
            <div className="flex gap-2 print:hidden">
              {regenButton('formative_assessment', 'Generate a fresh quiz with different questions at the same difficulty (useful for a retake).', 'New Quiz')}
            </div>
          )}
          {curriculum.formative_assessment.map((q, idx) => (
            <div key={idx} className="p-5 rounded-xl bg-gray-50 border border-gray-100">
              <p className="font-semibold text-gray-900 mb-3 text-lg">{idx + 1}. {q.question}</p>
              {q.type === 'multiple_choice' && q.options && q.options.length > 0 && (
                <ul className="space-y-2">
                  {q.options.map((opt, oIdx) => (
                    <li key={oIdx} className="flex items-start gap-2 text-gray-700">
                      <span className="inline-block w-6 h-6 rounded-full border border-gray-300 text-center text-sm leading-5 font-medium shrink-0 bg-white">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span>{opt}</span>
                    </li>
                  ))}
                </ul>
              )}
              {answerLineCount(q.type) > 0 && <AnswerLines count={answerLineCount(q.type)} />}
            </div>
          ))}
        </div>
      )
    }] : []),
    ...(curriculum.homework ? [{
      key: 'homework',
      label: 'Homework',
      icon: <Home className="w-6 h-6" />,
      content: (
        <div className="prose prose-slate prose-lg max-w-none text-gray-700 whitespace-pre-wrap leading-loose">
          {curriculum.homework}
        </div>
      )
    }] : [])
  ];

  const currentFocusStep = focusSteps[Math.min(focusStep, focusSteps.length - 1)];

  // Short label repeated on every printed page (footer) so loose sheets can be
  // matched back to the right packet and student.
  const packetLabel = [studentName, title, subtitle].filter(Boolean).join(' — ');

  // The student-facing packet: questions without answers, with the teacher
  // answer key forced onto its own page at the end. Rendered twice — once in
  // the preview modal (with the PDF-export ref) and once in a hidden print-only
  // portal that becomes the sole print target for the Print button.
  const renderStudentPacket = (attachRef: boolean) => (
    <div ref={attachRef ? printContentRef : undefined} className="space-y-8 bg-white max-w-4xl mx-auto p-4 md:p-8">
      {/* Lesson Header */}
      {title && (
        <div className="text-center border-b-2 border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-lg text-gray-500 mt-1">{subtitle}</p>}
          <div className="flex justify-center gap-12 mt-6 text-sm text-gray-600">
            <span>
              Name: {studentName
                ? <span className="font-semibold text-gray-900">{studentName}</span>
                : '______________________'}
            </span>
            <span>Date: ______________</span>
          </div>
        </div>
      )}

      {/* Reading Material */}
      <div className="bg-white rounded-2xl">
        <div className="flex items-center gap-3 mb-6 print:mb-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl print:p-0 print:bg-transparent">
            <FileText className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Lesson Reading Material</h2>
        </div>
        <div className="prose prose-slate max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
          {curriculum.reading_material}
        </div>
      </div>

      {/* Glossary */}
      {curriculum.glossary && curriculum.glossary.length > 0 && (
        <div className="bg-white rounded-2xl pt-4 border-t border-gray-100 print:border-t-2 print:border-gray-300">
          <div className="flex items-center gap-3 mb-6 print:mb-4">
            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl print:p-0 print:bg-transparent">
              <List className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Vocabulary & Glossary</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {curriculum.glossary.map((term, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-gray-50 border border-gray-100 print:bg-transparent print:border-gray-200">
                <h3 className="font-bold text-gray-900 mb-1">{term.word}</h3>
                <p className="text-gray-700 text-sm">{term.definition}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Worksheet */}
      <div className="bg-white rounded-2xl pt-4 border-t border-gray-100 print:border-t-2 print:border-gray-300">
        <div className="flex items-center gap-3 mb-6 print:mb-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl print:p-0 print:bg-transparent">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Student Worksheet</h2>
        </div>
        <div className="space-y-6">
          {curriculum.worksheet.map((q, idx) => (
            <div key={idx} className="p-5 rounded-xl bg-gray-50 border border-gray-100 print:bg-transparent print:border-gray-200">
              <p className="font-semibold text-gray-900 mb-3">{idx + 1}. {q.question}</p>

              {q.type === 'multiple_choice' && q.options && q.options.length > 0 && (
                <ul className="space-y-2">
                  {q.options.map((opt, oIdx) => (
                    <li key={oIdx} className="flex items-start gap-2 text-gray-700">
                      <span className="inline-block w-6 h-6 rounded-full border border-gray-300 text-center text-sm leading-5 font-medium shrink-0 bg-white">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span>{opt}</span>
                    </li>
                  ))}
                </ul>
              )}

              {answerLineCount(q.type) > 0 && <AnswerLines count={answerLineCount(q.type)} />}
            </div>
          ))}
        </div>
      </div>

      {/* Formative Assessment */}
      {curriculum.formative_assessment && curriculum.formative_assessment.length > 0 && (
        <div className="bg-white rounded-2xl pt-4 border-t border-gray-100 print:border-t-2 print:border-gray-300">
          <div className="flex items-center gap-3 mb-6 print:mb-4">
            <div className="p-3 bg-pink-50 text-pink-600 rounded-xl print:p-0 print:bg-transparent">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Quiz (Formative Assessment)</h2>
          </div>
          <div className="space-y-6">
            {curriculum.formative_assessment.map((q, idx) => (
              <div key={idx} className="p-5 rounded-xl bg-gray-50 border border-gray-100 print:bg-transparent print:border-gray-200">
                <p className="font-semibold text-gray-900 mb-3">{idx + 1}. {q.question}</p>

                {q.type === 'multiple_choice' && q.options && q.options.length > 0 && (
                  <ul className="space-y-2 mb-4">
                    {q.options.map((opt, oIdx) => (
                      <li key={oIdx} className="flex items-start gap-2 text-gray-700">
                        <span className="inline-block w-6 h-6 rounded-full border border-gray-300 text-center text-sm leading-5 font-medium shrink-0 bg-white">
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span>{opt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {answerLineCount(q.type) > 0 && <AnswerLines count={answerLineCount(q.type)} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Homework */}
      {curriculum.homework && (
        <div className="bg-white rounded-2xl pt-4 border-t border-gray-100 print:border-t-2 print:border-gray-300">
          <div className="flex items-center gap-3 mb-6 print:mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl print:p-0 print:bg-transparent">
              <Home className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Homework</h2>
          </div>
          <div className="prose prose-slate max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
            {curriculum.homework}
          </div>
        </div>
      )}

      {/* Teacher Answer Key — always starts on a fresh page so it can be pulled
          out of the student packet. The empty marker div is html2pdf's legacy
          page-break signal (Tailwind's print: classes don't apply during canvas
          capture); the inline breakBefore handles the browser's own print. */}
      {includeAnswerKey && (
        <div className="html2pdf__page-break" aria-hidden="true" />
      )}
      {includeAnswerKey && (
        <div style={{ breakBefore: 'page' }} className="bg-white rounded-2xl pt-4 border-t border-gray-100 print:border-t-2 print:border-gray-300 print:break-before-page">
          <div className="flex items-center gap-3 mb-2 print:mb-1">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl print:p-0 print:bg-transparent">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Teacher Answer Key</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">Keep this page separate from the student packet.</p>

          <h3 className="font-bold text-gray-900 mb-3">Worksheet</h3>
          <ol className="space-y-2 mb-6">
            {curriculum.worksheet.map((q, idx) => (
              <li key={idx} className="text-gray-700 text-sm">
                <span className="font-semibold text-gray-900">{idx + 1}.</span> {q.answer}
              </li>
            ))}
          </ol>

          {curriculum.formative_assessment && curriculum.formative_assessment.length > 0 && (
            <>
              <h3 className="font-bold text-gray-900 mb-3">Quiz</h3>
              <ol className="space-y-2">
                {curriculum.formative_assessment.map((q, idx) => (
                  <li key={idx} className="text-gray-700 text-sm">
                    <span className="font-semibold text-gray-900">{idx + 1}.</span> {q.answer}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
    <div className="space-y-8 mt-12 pb-12">
      <div className="flex justify-between flex-wrap gap-3 print:hidden mb-4">
        <button
          onClick={toggleFocusMode}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-sm font-medium border ${
            focusMode
              ? 'bg-slate-700 border-slate-700 text-white hover:bg-slate-800'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
          title="A calmer, one-section-at-a-time view of this lesson"
        >
          {focusMode ? <LayoutList className="w-4 h-4" /> : <Focus className="w-4 h-4" />}
          {focusMode ? 'Exit Focus Mode' : 'Focus Mode'}
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 border border-transparent text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={() => setShowPrintPreview(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm font-medium"
          >
            <FileText className="w-4 h-4" />
            Preview Student Binder
          </button>
        </div>
      </div>

      {/* Lesson Results / completion tracking */}
      {onSaveResults && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 print:hidden">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <ClipboardCheck className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Lesson Results</h2>
                {isCompleted ? (
                  <p className="text-sm text-emerald-700 font-medium">
                    Completed {new Date(results!.completedDate!).toLocaleDateString()}
                    {results?.worksheetScore && ` · Worksheet ${results.worksheetScore.correct}/${results.worksheetScore.total}`}
                    {results?.quizScore && ` · Quiz ${results.quizScore.correct}/${results.quizScore.total}`}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">Record scores when the student finishes — results shape the difficulty of future lessons.</p>
                )}
              </div>
            </div>
            {!editingResults && (
              <button
                onClick={() => setEditingResults(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-semibold shadow-sm"
              >
                {isCompleted ? <Pencil className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
                {isCompleted ? 'Edit Results' : 'Mark Complete'}
              </button>
            )}
          </div>

          {isCompleted && results?.notes && !editingResults && (
            <p className="mt-3 text-sm text-gray-600 italic">“{results.notes}”</p>
          )}

          {editingResults && (
            <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Worksheet Score (optional)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" placeholder="Correct" value={wsCorrect} onChange={(e) => setWsCorrect(e.target.value)}
                      className="w-24 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
                    <span className="text-gray-400 font-medium">out of</span>
                    <input type="number" min="1" placeholder="Total" value={wsTotal} onChange={(e) => setWsTotal(e.target.value)}
                      className="w-24 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Quiz Score (optional)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" placeholder="Correct" value={quizCorrect} onChange={(e) => setQuizCorrect(e.target.value)}
                      className="w-24 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
                    <span className="text-gray-400 font-medium">out of</span>
                    <input type="number" min="1" placeholder="Total" value={quizTotal} onChange={(e) => setQuizTotal(e.target.value)}
                      className="w-24 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Notes (optional)</label>
                <textarea rows={2} placeholder="e.g. Needed help with question 3; loved the reading."
                  value={resultNotes} onChange={(e) => setResultNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setEditingResults(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium">
                  Cancel
                </button>
                <button onClick={handleSaveResults} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium shadow-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  {isCompleted ? 'Save Results' : 'Save & Mark Complete'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {regenError && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-800 text-sm font-medium print:hidden">
          {regenError}
        </div>
      )}

      {focusMode ? (
        <motion.div
          key={currentFocusStep.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-10"
        >
          {/* Step progress dots */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {focusSteps.map((step, idx) => (
              <button
                key={step.key}
                onClick={() => setFocusStep(idx)}
                title={step.label}
                className={`h-2.5 rounded-full transition-all ${
                  idx === focusStep ? 'w-8 bg-slate-600' : 'w-2.5 bg-gray-200 hover:bg-gray-300'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3 mb-8 justify-center text-center">
            <div className="p-3 bg-gray-100 text-gray-500 rounded-xl">
              {currentFocusStep.icon}
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Step {focusStep + 1} of {focusSteps.length}
              </span>
              <h2 className="text-2xl font-bold text-gray-900">{currentFocusStep.label}</h2>
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            {currentFocusStep.content}
          </div>

          <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100">
            <button
              onClick={() => setFocusStep(s => Math.max(0, s - 1))}
              disabled={focusStep === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={() => setFocusStep(s => Math.min(focusSteps.length - 1, s + 1))}
              disabled={focusStep === focusSteps.length - 1}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      ) : (
      <div ref={contentRef} className="space-y-8">
        <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Presentation className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Teacher Guide</h2>
        </div>
        <div className="prose prose-slate max-w-none text-gray-700 whitespace-pre-wrap">
          {curriculum.teacher_guide}
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Lesson Plan</h2>
        </div>
        <div className="prose prose-slate max-w-none text-gray-700 whitespace-pre-wrap">
          {curriculum.lesson_plan}
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
      >
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Reading Material</h2>
          </div>
          {onRegenerateSection && (
            <div className="flex gap-2 print:hidden">
              {regenButton('reading_material', 'Rewrite the reading material at a noticeably simpler reading level with more scaffolding, shorter sentences, and more concrete examples.', 'Simpler')}
              {regenButton('reading_material', 'Rewrite the reading material at a more advanced, rigorous level with richer vocabulary and deeper conceptual treatment.', 'More Advanced')}
            </div>
          )}
        </div>
        
        {curriculum.readability_score && (
          <div className="mb-6 bg-purple-50 rounded-xl p-4 border border-purple-100 flex gap-4">
            <div className="mt-1 text-purple-500">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-purple-900">Readability Score: {curriculum.readability_score}</h3>
              <p className="text-purple-800 text-sm mt-1">{curriculum.readability_feedback}</p>
            </div>
          </div>
        )}

        <div className="prose prose-slate max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
          {curriculum.reading_material}
        </div>
      </motion.div>

      {curriculum.glossary && curriculum.glossary.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl">
              <List className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Glossary</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {curriculum.glossary.map((term, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-1">{term.word}</h3>
                <p className="text-gray-700 text-sm">{term.definition}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
      >
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Worksheet</h2>
          </div>
          {onRegenerateSection && (
            <div className="flex gap-2 print:hidden">
              {regenButton('worksheet', 'Make the questions noticeably easier and more scaffolded (add hints, simpler wording, more multiple choice).', 'Easier')}
              {regenButton('worksheet', 'Make the questions noticeably more challenging (more analysis, fewer multiple choice, deeper reasoning).', 'Harder')}
              {regenButton('worksheet', 'Generate a larger set of 6-8 questions covering the same material at similar difficulty.', 'More Questions')}
            </div>
          )}
        </div>
        <div className="space-y-6">
          {curriculum.worksheet.map((q, idx) => (
            <div key={idx} className="p-5 rounded-xl bg-gray-50 border border-gray-100">
              <p className="font-semibold text-gray-900 mb-3">{idx + 1}. {q.question}</p>
              
              {q.type === 'multiple_choice' && q.options && q.options.length > 0 && (
                <ul className="space-y-2 mb-4">
                  {q.options.map((opt, oIdx) => (
                    <li key={oIdx} className="flex items-start gap-2 text-gray-700">
                      <span className="inline-block w-6 h-6 rounded-full border border-gray-300 text-center text-sm leading-5 font-medium shrink-0 bg-white">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span>{opt}</span>
                    </li>
                  ))}
                </ul>
              )}
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-500 block mb-1">Answer / Rubric:</span>
                <span className="text-gray-800">{q.answer}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {curriculum.formative_assessment && curriculum.formative_assessment.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-pink-50 text-pink-600 rounded-xl">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Formative Assessment (Quiz)</h2>
            </div>
            {onRegenerateSection && (
              <div className="flex gap-2 print:hidden">
                {regenButton('formative_assessment', 'Generate a fresh quiz with different questions at the same difficulty (useful for a retake).', 'New Quiz')}
              </div>
            )}
          </div>
          <div className="space-y-6">
            {curriculum.formative_assessment.map((q, idx) => (
              <div key={idx} className="p-5 rounded-xl bg-gray-50 border border-gray-100">
                <p className="font-semibold text-gray-900 mb-3">{idx + 1}. {q.question}</p>
                
                {q.type === 'multiple_choice' && q.options && q.options.length > 0 && (
                  <ul className="space-y-2 mb-4">
                    {q.options.map((opt, oIdx) => (
                      <li key={oIdx} className="flex items-start gap-2 text-gray-700">
                        <span className="inline-block w-6 h-6 rounded-full border border-gray-300 text-center text-sm leading-5 font-medium shrink-0 bg-white">
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span>{opt}</span>
                      </li>
                    ))}
                  </ul>
                )}
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-500 block mb-1">Answer:</span>
                  <span className="text-gray-800">{q.answer}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Home className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Homework</h2>
        </div>
        <div className="prose prose-slate max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
          {curriculum.homework}
        </div>
      </motion.div>

      {curriculum.resources && curriculum.resources.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
              <Link className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">External Educational Resources</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {curriculum.resources.map((res, idx) => (
              <div key={idx} className="p-5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col h-full">
                <div className="flex items-center gap-2 mb-2 text-teal-700">
                  {renderResourceIcon(res.type)}
                  <span className="text-xs font-bold uppercase tracking-wider">{res.type}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{res.title}</h3>
                <p className="text-gray-600 text-sm mb-4 flex-grow">{res.description}</p>
                {res.url && (
                  <a 
                    href={res.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-teal-600 text-sm font-semibold hover:text-teal-700 inline-flex items-center mt-auto"
                  >
                    Visit Resource &rarr;
                  </a>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
      </div>
      )}
    </div>

    {/* Print Preview Modal */}
    {/* Rendered without AnimatePresence: its exit phase fails to unmount under React 19
        StrictMode, leaving an invisible overlay that blocks the whole app. */}
    {showPrintPreview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPrintPreview(false); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 p-4 md:p-8 backdrop-blur-sm print:hidden"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-100 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                Print Preview (Student View)
              </h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={includeAnswerKey}
                    onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  Include answer key
                </label>
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium disabled:opacity-50"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  {isExporting ? 'Generating PDF...' : 'Export to PDF'}
                </button>
                <button
                  onClick={() => setShowPrintPreview(false)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-grow bg-gray-100 p-4 md:p-8">
              {renderStudentPacket(true)}
            </div>
          </motion.div>
        </motion.div>
    )}

    {/* Hidden print-only copy of the student packet, rendered as a sibling of
        #root so the Print button outputs the packet (answer key on its own
        page) instead of the on-screen teacher view with inline answers. The
        footer repeats on every printed page via CSS in index.css. */}
    {createPortal(
      <div className="print-packet">
        {renderStudentPacket(false)}
        {packetLabel && <div className="print-packet-footer">{packetLabel}</div>}
      </div>,
      document.body
    )}
    </>
  );
}
