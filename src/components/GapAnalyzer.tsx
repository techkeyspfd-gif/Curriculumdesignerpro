import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Loader2, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { GapAnalysis } from '../types';
import { useStudents } from '../StudentContext';
import { postJson } from '../api';

export function GapAnalyzer() {
  const { selectedStudent, lessons } = useStudents();
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('5');

  const completedForStudent = selectedStudent
    ? lessons.filter(l => l.studentId === selectedStudent.id && l.results?.completedDate)
    : [];

  useEffect(() => {
    if (selectedStudent) {
      setGradeLevel(selectedStudent.gradeLevel.replace(/\D/g, '') || selectedStudent.gradeLevel);
    }
  }, [selectedStudent]);

  const [coveredTopics, setCoveredTopics] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<GapAnalysis | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !gradeLevel) return;

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const data = await postJson<GapAnalysis>('/api/analyze-gaps', {
        subject,
        gradeLevel,
        coveredTopics,
        completedLessons: completedForStudent.length > 0
          ? completedForStudent.map(l => `${l.subject}: ${l.topic}`).join('; ')
          : undefined,
        learningNeeds: selectedStudent?.learningNeeds,
        interests: selectedStudent?.interests
      });
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-8"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Subject</label>
              <input
                type="text"
                required
                placeholder="e.g. Science, Math"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                <span>Grade Level: {gradeLevel}</span>
              </label>
              <input
                type="range"
                min="3"
                max="12"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full h-2 mt-4 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-gray-400 font-medium px-1 mt-2">
                <span>Grade 3</span>
                <span>Grade 12</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Topics Already Covered (Optional)</label>
            <textarea
              rows={3}
              placeholder="e.g. We did fractions and decimals, but skipped geometry..."
              value={coveredTopics}
              onChange={(e) => setCoveredTopics(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
            />
            {completedForStudent.length > 0 && (
              <p className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {completedForStudent.length} completed lesson{completedForStudent.length === 1 ? '' : 's'} from {selectedStudent!.name}'s history will be included automatically.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !subject}
            className="w-full py-4 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Gaps...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Analyze Knowledge Gaps
              </>
            )}
          </button>
        </form>
      </motion.div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}

      {analysis && (
        <div className="space-y-8 pb-12">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-indigo-500" />
              Core Concepts Checklist
            </h2>
            <div className="space-y-6">
              {analysis.core_concepts.map((concept, idx) => (
                <div key={idx} className="p-5 rounded-xl bg-gray-50 border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-2">{concept.concept}</h3>
                  <p className="text-gray-600 text-sm mb-4">{concept.description}</p>
                  <div className="bg-white p-4 rounded-lg border border-indigo-100">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1 block">Diagnostic Question:</span>
                    <p className="text-gray-800 font-medium">{concept.verification_question}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-orange-500" />
              Common Homeschooling Gaps
            </h2>
            <div className="space-y-6">
              {analysis.common_gaps.map((gap, idx) => (
                <div key={idx} className="p-5 rounded-xl bg-orange-50/50 border border-orange-100">
                  <h3 className="font-semibold text-orange-900 mb-2">{gap.gap}</h3>
                  <p className="text-orange-800 text-sm mb-4"><span className="font-medium">Why it's missed:</span> {gap.reason}</p>
                  <div className="bg-white p-4 rounded-lg border border-orange-200">
                    <span className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1 block">Remediation Idea:</span>
                    <p className="text-gray-800">{gap.remediation_idea}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      )}
    </div>
  );
}
