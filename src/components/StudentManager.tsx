import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useStudents } from '../StudentContext';
import { Users, Plus, Trash2, GraduationCap, CheckCircle2, Cloud, CloudOff, Loader2, Pencil, Download, Upload, DatabaseBackup, AlertCircle, Sparkles } from 'lucide-react';
import { PortfolioView } from './PortfolioView';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { STUDENT_COLORS, colorForStudentId, getStudentColor } from '../studentColors';

interface DataStatus {
  ok: boolean;
  message: string;
}

export function StudentManager() {
  const {
    students, selectedStudent, addStudent, updateStudent, selectStudent, deleteStudent,
    lessons, yearPlans, dailyLogs, exportBackup, importBackup, restoreFromDrive, backupNow,
    isAutoBackupEnabled, setAutoBackupEnabled, googleUser, loginGoogle, logoutGoogle, isBackingUp, autoBackupError
  } = useStudents();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState('5');
  const [newLearningNeeds, setNewLearningNeeds] = useState('');
  const [newInterests, setNewInterests] = useState('');
  const [newColor, setNewColor] = useState<string>(() => STUDENT_COLORS[students.length % STUDENT_COLORS.length].id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editLearningNeeds, setEditLearningNeeds] = useState('');
  const [editInterests, setEditInterests] = useState('');
  const [editColor, setEditColor] = useState<string>('');
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  // Status for the Google Drive card (sign-in, backup, restore) so feedback
  // appears right next to the buttons that triggered it.
  const [syncStatus, setSyncStatus] = useState<DataStatus | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newGrade.trim()) {
      addStudent(newName.trim(), newGrade.trim(), newLearningNeeds.trim(), newInterests.trim(), newColor);
      setNewName('');
      setNewGrade('5');
      setNewLearningNeeds('');
      setNewInterests('');
      setNewColor(STUDENT_COLORS[(students.length + 1) % STUDENT_COLORS.length].id);
      setIsAdding(false);
    }
  };

  const startEditing = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    setEditingId(student.id);
    setEditName(student.name);
    setEditGrade(student.gradeLevel);
    setEditLearningNeeds(student.learningNeeds || '');
    setEditInterests(student.interests || '');
    setEditColor(student.color || colorForStudentId(student.id).id);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId && editName.trim() && editGrade.trim()) {
      updateStudent(editingId, {
        name: editName.trim(),
        gradeLevel: editGrade.trim(),
        learningNeeds: editLearningNeeds.trim() || undefined,
        interests: editInterests.trim() || undefined,
        color: editColor || undefined
      });
      setEditingId(null);
    }
  };

  const handleExport = () => {
    const payload = exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `curriculum-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDataStatus({ ok: true, message: 'Backup file downloaded.' });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDataStatus(null);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('That file is not valid JSON.');
      }
      const summary = importBackup(parsed);
      setDataStatus({ ok: true, message: `Imported ${summary.students} student(s) and ${summary.lessons} lesson(s).` });
    } catch (err: any) {
      setDataStatus({ ok: false, message: err.message || 'Import failed.' });
    }
  };

  const handleGoogleSignIn = async () => {
    setSyncStatus(null);
    setIsSigningIn(true);
    try {
      await loginGoogle();
      setSyncStatus({ ok: true, message: 'Connected to Google Drive.' });
    } catch (err: any) {
      setSyncStatus({ ok: false, message: err.message || 'Google sign-in failed.' });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleBackupNow = async () => {
    setSyncStatus(null);
    try {
      await backupNow();
      setSyncStatus({ ok: true, message: 'Backed up to Google Drive successfully.' });
    } catch (err: any) {
      setSyncStatus({ ok: false, message: err.message || 'Backup failed.' });
    }
  };

  const handleRestoreFromDrive = async () => {
    if (!confirm('Merge the Google Drive backup into your local data? Local entries with the same ID will be overwritten by the backup.')) return;
    setIsRestoring(true);
    setSyncStatus(null);
    try {
      const summary = await restoreFromDrive();
      if (summary === null) {
        setSyncStatus({ ok: false, message: 'No backup file was found in your Google Drive.' });
      } else {
        setSyncStatus({ ok: true, message: `Restored ${summary.students} student(s) and ${summary.lessons} lesson(s) from Drive.` });
      }
    } catch (err: any) {
      setSyncStatus({ ok: false, message: err.message || 'Restore failed.' });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Student Profiles</h2>
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        </div>

        {isAdding && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleAddStudent}
            className="mb-8 p-6 bg-gray-50 border border-gray-200 rounded-2xl space-y-4"
          >
            <h3 className="font-semibold text-gray-900 mb-2">Create New Profile</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Student Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zoe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Grade Level</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 8th Grade"
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Learning Needs & Traits (Optional)</label>
              <textarea
                placeholder="e.g. autistic — needs literal language and predictable structure; ADHD; visual learner; struggles with reading comprehension..."
                value={newLearningNeeds}
                onChange={(e) => setNewLearningNeeds(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[80px] resize-y"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Special Interests (Optional)</label>
              <textarea
                placeholder="e.g. trains, Minecraft, dinosaurs, space — these get woven into lessons, examples, and word problems to boost engagement"
                value={newInterests}
                onChange={(e) => setNewInterests(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[60px] resize-y"
              />
            </div>
            <ColorSwatchPicker value={newColor} onChange={setNewColor} />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-xl transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm"
              >
                Save Profile
              </button>
            </div>
          </motion.form>
        )}

        <div className="space-y-4">
          {students.length === 0 ? (
            <div className="text-center py-14 text-gray-500">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 mb-4">
                <Sparkles className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-gray-700 font-semibold">Let's set up your first student</p>
              <p className="text-sm mt-1 max-w-xs mx-auto">Add a name, grade, and anything that makes them unique — their profile powers every lesson the app generates for them.</p>
              <button
                onClick={() => setIsAdding(true)}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Student
              </button>
            </div>
          ) : (
            students.map(student => (
              editingId === student.id ? (
                <form
                  key={student.id}
                  onSubmit={handleSaveEdit}
                  className="p-6 rounded-2xl border border-indigo-300 bg-indigo-50/30 space-y-4"
                >
                  <h3 className="font-semibold text-gray-900">Edit Profile</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Student Name</label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Grade Level</label>
                      <input
                        type="text"
                        required
                        value={editGrade}
                        onChange={(e) => setEditGrade(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Learning Needs & Traits (Optional)</label>
                    <textarea
                      value={editLearningNeeds}
                      onChange={(e) => setEditLearningNeeds(e.target.value)}
                      placeholder="e.g. autistic — needs literal language and predictable structure; visual learner..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[80px] resize-y"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Special Interests (Optional)</label>
                    <textarea
                      value={editInterests}
                      onChange={(e) => setEditInterests(e.target.value)}
                      placeholder="e.g. trains, Minecraft, dinosaurs, space — woven into lessons to boost engagement"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[60px] resize-y"
                    />
                  </div>
                  <ColorSwatchPicker value={editColor} onChange={setEditColor} />
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-xl transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
              (() => { const studentColor = getStudentColor(student.color || colorForStudentId(student.id).id); return (
              <div
                key={student.id}
                className={`p-5 rounded-2xl border border-gray-200 border-l-4 ${studentColor.accentBorder} transition-all cursor-pointer flex items-center justify-between ${
                  selectedStudent?.id === student.id
                    ? `ring-2 ${studentColor.ring} bg-indigo-50/40 shadow-sm`
                    : 'bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => selectStudent(student.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white ${studentColor.swatch}`}>
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                      {student.name}
                      {selectedStudent?.id === student.id && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      )}
                    </h3>
                    <p className="text-gray-500 text-sm flex items-center gap-1">
                      <GraduationCap className="w-4 h-4" />
                      {student.gradeLevel}
                    </p>
                    {student.learningNeeds && (
                      <p className="text-gray-400 text-xs mt-1 truncate max-w-xs md:max-w-sm">
                        {student.learningNeeds}
                      </p>
                    )}
                    {student.interests && (
                      <p className="text-indigo-400 text-xs mt-0.5 truncate max-w-xs md:max-w-sm">
                        ★ {student.interests}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500 hidden md:block">
                    {student.assessmentHistory.length} Assessment(s)
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(student.id);
                    }}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit Profile"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this student profile?')) {
                        deleteStudent(student.id);
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Profile"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              ); })()
              )
            ))
          )}
        </div>
      </motion.div>

      {/* Cloud Sync Settings */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-3 rounded-xl ${googleUser ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
            {googleUser ? <Cloud className="w-6 h-6" /> : <CloudOff className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Google Drive Cloud Sync</h3>
            <p className="text-gray-500 text-sm">Automatically backup student profiles, lessons, and history</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-5 bg-gray-50 border border-gray-200 rounded-2xl">
          <div>
            {googleUser ? (
              <div>
                <p className="text-sm font-semibold text-gray-900">Signed in as {googleUser.displayName || googleUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isAutoBackupEnabled}
                        onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${isAutoBackupEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isAutoBackupEnabled ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <div className="ml-3 text-sm text-gray-700 font-medium">
                      Enable Auto-Backup
                    </div>
                  </label>
                  {isBackingUp && (
                    <span className="flex items-center gap-1 text-xs text-indigo-600 ml-4">
                      <Loader2 className="w-3 h-3 animate-spin" /> Backing up...
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-gray-900">Not signed in</p>
                <p className="text-sm text-gray-500 mt-1">Sign in with Google to enable automatic backups to your Drive.</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {googleUser ? (
              <>
                <button
                  onClick={handleBackupNow}
                  disabled={isBackingUp}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-sm whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
                >
                  {isBackingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                  {isBackingUp ? 'Backing up...' : 'Back up now'}
                </button>
                <button
                  onClick={handleRestoreFromDrive}
                  disabled={isRestoring}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-semibold shadow-sm whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
                >
                  {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />}
                  {isRestoring ? 'Restoring...' : 'Restore from Drive'}
                </button>
                <button
                  onClick={logoutGoogle}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-semibold shadow-sm whitespace-nowrap"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-sm whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
              >
                {isSigningIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                {isSigningIn ? 'Waiting for Google...' : 'Sign in with Google'}
              </button>
            )}
          </div>
        </div>

        {syncStatus && (
          <div className={`mt-4 p-3 rounded-xl text-sm flex items-start gap-2 border ${
            syncStatus.ok
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : 'bg-red-50 border-red-100 text-red-800'
          }`}>
            {syncStatus.ok
              ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />}
            <span>{syncStatus.message}</span>
          </div>
        )}

        {googleUser && autoBackupError && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <span><span className="font-semibold">Last auto-backup didn't complete:</span> {autoBackupError}</span>
          </div>
        )}
      </motion.div>

      {/* Local Backup: Export / Import */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Local Backup</h3>
            <p className="text-gray-500 text-sm">
              Download everything ({students.length} student{students.length === 1 ? '' : 's'}, {lessons.length} lesson{lessons.length === 1 ? '' : 's'}, {yearPlans.length} year plan{yearPlans.length === 1 ? '' : 's'}, {dailyLogs.length} time log{dailyLogs.length === 1 ? '' : 's'}) as a JSON file, or import a previous backup.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-semibold shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Import Data
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        {dataStatus && (
          <div className={`mt-4 p-3 rounded-xl flex items-start gap-2 text-sm font-medium ${
            dataStatus.ok
              ? 'bg-emerald-50 border border-emerald-100 text-emerald-800'
              : 'bg-red-50 border border-red-100 text-red-800'
          }`}>
            {dataStatus.ok
              ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />}
            <span>{dataStatus.message}</span>
          </div>
        )}
      </motion.div>

      {/* Portfolio & records for selected student */}
      {selectedStudent && <PortfolioView student={selectedStudent} />}

      {/* History section for selected student */}
      {selectedStudent && selectedStudent.assessmentHistory.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
        >
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            Assessment History for {selectedStudent.name}
          </h3>
          <div className="space-y-4">
            {selectedStudent.assessmentHistory.map((record, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-gray-50 border border-gray-200">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                      {new Date(record.date).toLocaleDateString()}
                    </span>
                    <h4 className="font-bold text-gray-900 text-lg">{record.subject}: {record.topic}</h4>
                  </div>
                  <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm font-semibold text-gray-700 shadow-sm">
                    Suggested Grade: {record.assessment.suggested_grade}
                  </span>
                </div>
                <p className="text-gray-700 text-sm mb-4">{record.assessment.rationale}</p>
                <div>
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2 block">Focus Areas</span>
                  <div className="flex flex-wrap gap-2">
                    {record.assessment.focus_areas.map((area, i) => (
                      <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-100">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
