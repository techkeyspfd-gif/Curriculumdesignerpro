import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Loader2, AlertCircle, BarChart3, ListChecks, Save, CheckCircle2, GraduationCap } from 'lucide-react';
import { GradeAssessment } from '../types';
import { useStudents } from '../StudentContext';
import { postJson } from '../api';

export function GradeAssessor() {
  const { selectedStudent, addAssessmentToStudent, updateStudent } = useStudents();
  const [subject, setSubject] = useState('');
  const [topicContext, setTopicContext] = useState('');
  const [studentData, setStudentData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<GradeAssessment | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [gradeApplied, setGradeApplied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentData) return;

    setIsLoading(true);
    setError(null);
    setAssessment(null);
    setIsSaved(false);
    setGradeApplied(false);

    try {
      const data = await postJson<GradeAssessment>('/api/assess-grade', {
        subject,
        studentData,
        learningNeeds: selectedStudent?.learningNeeds,
        interests: selectedStudent?.interests
      });
      setAssessment(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyGrade = () => {
    if (selectedStudent && assessment) {
      updateStudent(selectedStudent.id, { gradeLevel: assessment.suggested_grade.replace(/^Grade\s*/i, '') });
      setGradeApplied(true);
    }
  };

  const handleSaveToProfile = () => {
    if (selectedStudent && assessment) {
      addAssessmentToStudent(selectedStudent.id, {
        date: new Date().toISOString(),
        subject: subject || 'General',
        topic: topicContext || 'General Assessment',
        gradeLevel: assessment.suggested_grade,
        assessment: assessment
      });
      setIsSaved(true);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Subject Context (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Creative Writing, Algebra, etc."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Topic Context (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Fractions, Essay Writing, etc."
                value={topicContext}
                onChange={(e) => setTopicContext(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Student Work / Description</label>
            <textarea
              required
              rows={6}
              placeholder="Paste a student's writing sample, a description of how they solved a math problem, or their general abilities..."
              value={studentData}
              onChange={(e) => setStudentData(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !studentData}
            className="w-full py-4 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Assess Grade Level
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

      {assessment && (
        <div className="space-y-8 pb-12">
          {selectedStudent && (
            <div className="flex justify-end flex-wrap gap-3 -mb-4">
              <button
                onClick={handleApplyGrade}
                disabled={gradeApplied}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gradeApplied ? <CheckCircle2 className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                {gradeApplied ? 'Grade updated' : `Set ${selectedStudent.name}'s grade to ${assessment.suggested_grade}`}
              </button>
              <button
                onClick={handleSaveToProfile}
                disabled={isSaved}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaved ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Save className="w-5 h-5" />}
                {isSaved ? 'Saved to ' + selectedStudent.name : 'Save to ' + selectedStudent.name}
              </button>
            </div>
          )}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-sm p-8 text-white text-center"
          >
            <div className="inline-flex items-center justify-center p-3 bg-white/20 rounded-xl mb-4 backdrop-blur-sm">
              <BarChart3 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-indigo-100 mb-1">Estimated Level</h3>
            <div className="text-4xl font-bold tracking-tight">
              {assessment.suggested_grade}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              Rationale
            </h2>
            <div className="prose prose-slate max-w-none text-gray-700 leading-relaxed">
              {assessment.rationale}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-emerald-500" />
              Recommended Focus Areas
            </h2>
            <ul className="space-y-3">
              {assessment.focus_areas.map((area, idx) => (
                <li key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100 text-gray-700">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm">
                    {idx + 1}
                  </span>
                  <span className="pt-0.5">{area}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </div>
  );
}
