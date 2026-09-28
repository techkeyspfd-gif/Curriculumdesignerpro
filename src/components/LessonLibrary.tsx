import React from 'react';
import { motion } from 'motion/react';
import { Library, Trash2, FolderOpen, GraduationCap, User, CheckCircle2 } from 'lucide-react';
import { SavedLesson } from '../types';
import { useStudents } from '../StudentContext';
import { getStudentColor, colorForStudentId } from '../studentColors';

interface Props {
  activeLessonId: string | null;
  onLoad: (lesson: SavedLesson) => void;
}

export function LessonLibrary({ activeLessonId, onLoad }: Props) {
  const { lessons, students, deleteLesson } = useStudents();

  if (lessons.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="mt-8 bg-white rounded-3xl shadow-sm border border-gray-100 p-8 print:hidden"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
          <Library className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Lesson Library</h2>
          <p className="text-gray-500 text-sm">Every generated lesson is saved here automatically — nothing is lost on refresh.</p>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {lessons.map(lesson => {
          const student = lesson.studentId ? students.find(s => s.id === lesson.studentId) : undefined;
          const studentColor = student ? getStudentColor(student.color || colorForStudentId(student.id).id) : null;
          return (
          <div
            key={lesson.id}
            className={`p-4 rounded-2xl border border-gray-200 border-l-4 ${studentColor?.accentBorder || 'border-l-gray-300'} transition-all flex items-center justify-between gap-4 ${
              activeLessonId === lesson.id
                ? 'ring-2 ring-violet-300 bg-violet-50/50'
                : 'bg-gray-50 hover:border-gray-300 hover:bg-white'
            }`}
          >
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 truncate flex items-center gap-2">
                {lesson.topic}
                {lesson.results?.completedDate && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-semibold shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Done
                    {lesson.results.quizScore && ` · ${lesson.results.quizScore.correct}/${lesson.results.quizScore.total}`}
                  </span>
                )}
              </h3>
              <p className="text-gray-500 text-sm flex items-center gap-x-3 gap-y-1 flex-wrap mt-0.5">
                <span>{lesson.subject}</span>
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {lesson.gradeLevel}
                </span>
                {lesson.studentName && (
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {lesson.studentName}
                  </span>
                )}
                <span className="text-gray-400">{new Date(lesson.date).toLocaleDateString()}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onLoad(lesson)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:border-violet-300 hover:text-violet-700 transition-colors text-sm font-semibold shadow-sm"
              >
                <FolderOpen className="w-4 h-4" />
                Open
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete the saved lesson "${lesson.topic}"?`)) {
                    deleteLesson(lesson.id);
                  }
                }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Lesson"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          );
        })}
      </div>
    </motion.div>
  );
}
