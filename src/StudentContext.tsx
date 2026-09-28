import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import {
  StudentProfile, AssessmentRecord, SavedLesson, YearPlan, QuarterlyCurriculum, PlanSource, DailyLog,
  WorkSample, Activity, AttendanceMark, Assignment, Observation, StandardMastery, TestPrepSet, ReadingAnalysis
} from './types';
import { initAuth, googleSignIn, logout, backupToGoogleDrive, restoreFromGoogleDrive } from './googleDrive';

const MAX_SAVED_LESSONS = 50;
const BACKUP_VERSION = 4;

export interface BackupPayload {
  version: number;
  students: StudentProfile[];
  lessons: SavedLesson[];
  yearPlans: YearPlan[];
  dailyLogs: DailyLog[];
  workSamples: WorkSample[];
  activities: Activity[];
  attendance: AttendanceMark[];
  assignments: Assignment[];
  observations: Observation[];
  standards: StandardMastery[];
  testPrepSets: TestPrepSet[];
  readingAnalyses: ReadingAnalysis[];
}

interface ImportSummary {
  students: number;
  lessons: number;
  yearPlans: number;
  dailyLogs: number;
  records: number; // combined count of work samples, activities, attendance, etc.
}

interface StudentContextType {
  students: StudentProfile[];
  selectedStudent: StudentProfile | null;
  addStudent: (name: string, gradeLevel: string, learningNeeds?: string, interests?: string, color?: string) => void;
  updateStudent: (id: string, updates: Partial<StudentProfile>) => void;
  deleteStudent: (id: string) => void;
  selectStudent: (id: string | null) => void;
  addAssessmentToStudent: (studentId: string, record: AssessmentRecord) => void;
  lessons: SavedLesson[];
  saveLesson: (lesson: SavedLesson) => void;
  updateLesson: (id: string, updates: Partial<SavedLesson>) => void;
  deleteLesson: (id: string) => void;
  yearPlans: YearPlan[];
  upsertYearPlanQuarter: (student: StudentProfile, quarterIndex: number, quarter: QuarterlyCurriculum) => void;
  toggleWeekComplete: (source: PlanSource) => void;
  deleteYearPlan: (id: string) => void;
  dailyLogs: DailyLog[];
  saveDailyLog: (log: DailyLog) => void;
  deleteDailyLog: (id: string) => void;

  // ---- records & collaboration collections ----
  workSamples: WorkSample[];
  addWorkSample: (sample: WorkSample) => void;
  updateWorkSample: (id: string, updates: Partial<WorkSample>) => void;
  deleteWorkSample: (id: string) => void;

  activities: Activity[];
  addActivity: (activity: Activity) => void;
  updateActivity: (id: string, updates: Partial<Activity>) => void;
  deleteActivity: (id: string) => void;

  attendance: AttendanceMark[];
  setAttendanceMark: (mark: AttendanceMark) => void;   // upsert by student + date
  deleteAttendanceMark: (studentId: string, date: string) => void;

  assignments: Assignment[];
  addAssignment: (assignment: Assignment) => void;
  updateAssignment: (id: string, updates: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;

  observations: Observation[];
  addObservation: (observation: Observation) => void;
  deleteObservation: (id: string) => void;

  standards: StandardMastery[];
  addStandards: (items: StandardMastery[]) => void;
  updateStandard: (id: string, updates: Partial<StandardMastery>) => void;
  deleteStandard: (id: string) => void;

  testPrepSets: TestPrepSet[];
  addTestPrepSet: (set: TestPrepSet) => void;
  updateTestPrepSet: (id: string, updates: Partial<TestPrepSet>) => void;
  deleteTestPrepSet: (id: string) => void;

  readingAnalyses: ReadingAnalysis[];
  addReadingAnalysis: (analysis: ReadingAnalysis) => void;
  deleteReadingAnalysis: (id: string) => void;

  exportBackup: () => BackupPayload;
  importBackup: (data: unknown) => ImportSummary;
  restoreFromDrive: () => Promise<ImportSummary | null>;
  backupNow: () => Promise<void>;
  isAutoBackupEnabled: boolean;
  setAutoBackupEnabled: (enabled: boolean) => void;
  googleUser: any | null;
  loginGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
  isBackingUp: boolean;
  autoBackupError: string | null;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

function loadFromStorage<T>(key: string, fallback: T): T {
  const saved = localStorage.getItem(key);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { return fallback; }
  }
  return fallback;
}

function persistToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Quota exceeded or storage unavailable — keep the app running on in-memory state.
    console.error(`Failed to persist ${key}:`, e);
  }
}

const normalizeStudent = (s: any): StudentProfile => ({
  ...s,
  assessmentHistory: Array.isArray(s?.assessmentHistory) ? s.assessmentHistory : []
});

const arr = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);

// Accepts the current versioned payload, older payloads missing newer
// collections, and the legacy format (a bare array of students).
function normalizeBackup(data: any) {
  if (Array.isArray(data)) {
    return {
      students: data.filter(s => s?.id).map(normalizeStudent),
      lessons: [] as SavedLesson[], yearPlans: [] as YearPlan[], dailyLogs: [] as DailyLog[],
      workSamples: [] as WorkSample[], activities: [] as Activity[], attendance: [] as AttendanceMark[],
      assignments: [] as Assignment[], observations: [] as Observation[], standards: [] as StandardMastery[],
      testPrepSets: [] as TestPrepSet[], readingAnalyses: [] as ReadingAnalysis[]
    };
  }
  return {
    students: arr<any>(data?.students).filter((s: any) => s?.id).map(normalizeStudent) as StudentProfile[],
    lessons: arr<any>(data?.lessons).filter((l: any) => l?.id && l?.curriculum) as SavedLesson[],
    yearPlans: arr<any>(data?.yearPlans).filter((p: any) => p?.id && Array.isArray(p?.quarters)) as YearPlan[],
    dailyLogs: arr<any>(data?.dailyLogs).filter((l: any) => l?.id && Array.isArray(l?.entries)) as DailyLog[],
    workSamples: arr<any>(data?.workSamples).filter((w: any) => w?.id && w?.dataUrl) as WorkSample[],
    activities: arr<any>(data?.activities).filter((a: any) => a?.id) as Activity[],
    attendance: arr<any>(data?.attendance).filter((a: any) => a?.id && a?.date) as AttendanceMark[],
    assignments: arr<any>(data?.assignments).filter((a: any) => a?.id) as Assignment[],
    observations: arr<any>(data?.observations).filter((o: any) => o?.id) as Observation[],
    standards: arr<any>(data?.standards).filter((s: any) => s?.id) as StandardMastery[],
    testPrepSets: arr<any>(data?.testPrepSets).filter((t: any) => t?.id && Array.isArray(t?.questions)) as TestPrepSet[],
    readingAnalyses: arr<any>(data?.readingAnalyses).filter((r: any) => r?.id) as ReadingAnalysis[]
  };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map(item => [item.id, item]));
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

export function StudentProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<StudentProfile[]>(() => loadFromStorage('studentProfiles', []));
  const [lessons, setLessons] = useState<SavedLesson[]>(() => loadFromStorage('savedLessons', []));
  const [yearPlans, setYearPlans] = useState<YearPlan[]>(() => loadFromStorage('yearPlans', []));
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>(() => loadFromStorage('dailyLogs', []));
  const [workSamples, setWorkSamples] = useState<WorkSample[]>(() => loadFromStorage('workSamples', []));
  const [activities, setActivities] = useState<Activity[]>(() => loadFromStorage('activities', []));
  const [attendance, setAttendance] = useState<AttendanceMark[]>(() => loadFromStorage('attendance', []));
  const [assignments, setAssignments] = useState<Assignment[]>(() => loadFromStorage('assignments', []));
  const [observations, setObservations] = useState<Observation[]>(() => loadFromStorage('observations', []));
  const [standards, setStandards] = useState<StandardMastery[]>(() => loadFromStorage('standards', []));
  const [testPrepSets, setTestPrepSets] = useState<TestPrepSet[]>(() => loadFromStorage('testPrepSets', []));
  const [readingAnalyses, setReadingAnalyses] = useState<ReadingAnalysis[]>(() => loadFromStorage('readingAnalyses', []));
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(() => localStorage.getItem('selectedStudentId'));

  const [isAutoBackupEnabled, setIsAutoBackupEnabled] = useState<boolean>(() => {
    return localStorage.getItem('autoBackupEnabled') === 'true';
  });
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [autoBackupError, setAutoBackupError] = useState<string | null>(null);

  const initialLoadDone = useRef(false);

  const buildPayload = (): BackupPayload => ({
    version: BACKUP_VERSION,
    students, lessons, yearPlans, dailyLogs,
    workSamples, activities, attendance, assignments, observations, standards, testPrepSets, readingAnalyses
  });

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => setGoogleUser(user),
      () => {
        setGoogleUser(null);
        if (isAutoBackupEnabled) {
          setIsAutoBackupEnabled(false);
          localStorage.setItem('autoBackupEnabled', 'false');
        }
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('autoBackupEnabled', isAutoBackupEnabled.toString());
  }, [isAutoBackupEnabled]);

  useEffect(() => {
    persistToStorage('studentProfiles', students);
    persistToStorage('savedLessons', lessons);
    persistToStorage('yearPlans', yearPlans);
    persistToStorage('dailyLogs', dailyLogs);
    persistToStorage('workSamples', workSamples);
    persistToStorage('activities', activities);
    persistToStorage('attendance', attendance);
    persistToStorage('assignments', assignments);
    persistToStorage('observations', observations);
    persistToStorage('standards', standards);
    persistToStorage('testPrepSets', testPrepSets);
    persistToStorage('readingAnalyses', readingAnalyses);

    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }

    // Auto backup if enabled and initial load is done
    if (isAutoBackupEnabled && googleUser) {
      const runBackup = async () => {
        setIsBackingUp(true);
        try {
          await backupToGoogleDrive(buildPayload());
          setAutoBackupError(null);
          console.log('Auto-backup to Google Drive successful');
        } catch (error: any) {
          setAutoBackupError(error?.message || 'Auto-backup failed');
          console.error('Auto-backup failed:', error);
        } finally {
          setIsBackingUp(false);
        }
      };

      // Debounce backup to prevent spamming the API on rapid changes
      const timeout = setTimeout(() => {
        runBackup();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [students, lessons, yearPlans, dailyLogs, workSamples, activities, attendance, assignments, observations, standards, testPrepSets, readingAnalyses, isAutoBackupEnabled, googleUser]);

  useEffect(() => {
    if (selectedStudentId) {
      localStorage.setItem('selectedStudentId', selectedStudentId);
    } else {
      localStorage.removeItem('selectedStudentId');
    }
  }, [selectedStudentId]);

  const selectedStudent = students.find(s => s.id === selectedStudentId) || null;

  // Errors propagate to the caller so the UI can show why sign-in failed
  // (previously they were swallowed and the button appeared to do nothing).
  const loginGoogle = async () => {
    const res = await googleSignIn();
    if (res?.user) {
      setGoogleUser(res.user);
    }
  };

  const logoutGoogle = async () => {
    await logout();
    setGoogleUser(null);
    setIsAutoBackupEnabled(false);
  };

  const addStudent = (name: string, gradeLevel: string, learningNeeds?: string, interests?: string, color?: string) => {
    const newStudent: StudentProfile = { id: crypto.randomUUID(), name, gradeLevel, learningNeeds, interests, color, assessmentHistory: [] };
    setStudents(prev => [...prev, newStudent]);
    if (!selectedStudentId) setSelectedStudentId(newStudent.id);
  };

  const updateStudent = (id: string, updates: Partial<StudentProfile>) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteStudent = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    // Cascade-remove this student's records so nothing dangles in storage.
    setWorkSamples(prev => prev.filter(w => w.studentId !== id));
    setActivities(prev => prev.filter(a => a.studentId !== id));
    setAttendance(prev => prev.filter(a => a.studentId !== id));
    setAssignments(prev => prev.filter(a => a.studentId !== id));
    setObservations(prev => prev.filter(o => o.studentId !== id));
    setStandards(prev => prev.filter(s => s.studentId !== id));
    setTestPrepSets(prev => prev.filter(t => t.studentId !== id));
    if (selectedStudentId === id) setSelectedStudentId(null);
  };

  const selectStudent = (id: string | null) => setSelectedStudentId(id);

  const addAssessmentToStudent = (studentId: string, record: AssessmentRecord) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, assessmentHistory: [record, ...s.assessmentHistory] } : s));
  };

  const saveLesson = (lesson: SavedLesson) => {
    setLessons(prev => [lesson, ...prev].slice(0, MAX_SAVED_LESSONS));
  };

  const setWeekCompleted = (source: PlanSource, value: boolean | 'toggle') => {
    setYearPlans(prev => prev.map(plan => {
      if (plan.id !== source.yearPlanId) return plan;
      return {
        ...plan,
        quarters: plan.quarters.map((quarter, qi) => {
          if (qi !== source.quarterIndex) return quarter;
          return {
            ...quarter,
            subjects: quarter.subjects.map((subject, si) => {
              if (si !== source.subjectIndex) return subject;
              return {
                ...subject,
                weekly_plan: subject.weekly_plan.map((week, wi) => {
                  if (wi !== source.weekIndex) return week;
                  return { ...week, completed: value === 'toggle' ? !week.completed : value };
                })
              };
            })
          };
        })
      };
    }));
  };

  const updateLesson = (id: string, updates: Partial<SavedLesson>) => {
    setLessons(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    // Completing a lesson that came from a year-plan week checks that week off automatically.
    if (updates.results?.completedDate) {
      const lesson = lessons.find(l => l.id === id);
      if (lesson?.source) {
        setWeekCompleted(lesson.source, true);
      }
      // Also close out any linked assignment.
      setAssignments(prev => prev.map(a => a.lessonId === id ? { ...a, status: 'done' } : a));
    }
  };

  const deleteLesson = (id: string) => {
    setLessons(prev => prev.filter(l => l.id !== id));
  };

  // Fully functional update: sequential quarter generations within one render
  // cycle must all land on the same plan, so existence is decided inside the updater.
  const upsertYearPlanQuarter = (student: StudentProfile, quarterIndex: number, quarter: QuarterlyCurriculum) => {
    const newId = crypto.randomUUID();
    setYearPlans(prev => {
      const current = prev.find(p => p.studentId === student.id);
      if (current) {
        return prev.map(p => {
          if (p.studentId !== student.id) return p;
          const quarters = [...p.quarters];
          quarters[Math.min(quarterIndex, quarters.length)] = quarter;
          return { ...p, gradeLevel: student.gradeLevel, quarters };
        });
      }
      return [...prev, {
        id: newId,
        studentId: student.id,
        studentName: student.name,
        gradeLevel: student.gradeLevel,
        createdDate: new Date().toISOString(),
        quarters: [quarter]
      }];
    });
  };

  const toggleWeekComplete = (source: PlanSource) => setWeekCompleted(source, 'toggle');

  const deleteYearPlan = (id: string) => {
    setYearPlans(prev => prev.filter(p => p.id !== id));
  };

  // One log per student per date: saving replaces any existing entry for that day.
  const saveDailyLog = (log: DailyLog) => {
    setDailyLogs(prev => {
      const without = prev.filter(l => !(l.studentId === log.studentId && l.date === log.date));
      return [...without, log];
    });
  };

  const deleteDailyLog = (id: string) => {
    setDailyLogs(prev => prev.filter(l => l.id !== id));
  };

  // ---- generic CRUD for the new record collections ----
  const addTo = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>) => (item: T) => setter(prev => [item, ...prev]);
  const updateIn = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>) =>
    (id: string, updates: Partial<T>) => setter(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x));
  const removeFrom = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>) =>
    (id: string) => setter(prev => prev.filter(x => x.id !== id));

  const addWorkSample = addTo(setWorkSamples);
  const updateWorkSample = updateIn(setWorkSamples);
  const deleteWorkSample = removeFrom(setWorkSamples);

  const addActivity = addTo(setActivities);
  const updateActivity = updateIn(setActivities);
  const deleteActivity = removeFrom(setActivities);

  // Attendance is one mark per student per date.
  const setAttendanceMark = (mark: AttendanceMark) => {
    setAttendance(prev => {
      const without = prev.filter(m => !(m.studentId === mark.studentId && m.date === mark.date));
      return [mark, ...without];
    });
  };
  const deleteAttendanceMark = (studentId: string, date: string) => {
    setAttendance(prev => prev.filter(m => !(m.studentId === studentId && m.date === date)));
  };

  const addAssignment = addTo(setAssignments);
  const updateAssignment = updateIn(setAssignments);
  const deleteAssignment = removeFrom(setAssignments);

  const addObservation = addTo(setObservations);
  const deleteObservation = removeFrom(setObservations);

  const addStandards = (items: StandardMastery[]) => {
    // De-dupe against existing (same student + framework + code).
    setStandards(prev => {
      const seen = new Set(prev.map(s => `${s.studentId}|${s.framework}|${s.code}`));
      const fresh = items.filter(i => !seen.has(`${i.studentId}|${i.framework}|${i.code}`));
      return [...fresh, ...prev];
    });
  };
  const updateStandard = updateIn(setStandards);
  const deleteStandard = removeFrom(setStandards);

  const addTestPrepSet = addTo(setTestPrepSets);
  const updateTestPrepSet = updateIn(setTestPrepSets);
  const deleteTestPrepSet = removeFrom(setTestPrepSets);

  const addReadingAnalysis = addTo(setReadingAnalyses);
  const deleteReadingAnalysis = removeFrom(setReadingAnalyses);

  const exportBackup = (): BackupPayload => buildPayload();

  const importBackup = (data: unknown): ImportSummary => {
    const n = normalizeBackup(data);
    const recordCount = n.workSamples.length + n.activities.length + n.attendance.length +
      n.assignments.length + n.observations.length + n.standards.length + n.testPrepSets.length + n.readingAnalyses.length;
    if (n.students.length === 0 && n.lessons.length === 0 && n.yearPlans.length === 0 && n.dailyLogs.length === 0 && recordCount === 0) {
      throw new Error('No student profiles, lessons, plans, or records found in this file.');
    }
    setStudents(prev => mergeById(prev, n.students));
    setLessons(prev => mergeById(prev, n.lessons).slice(0, MAX_SAVED_LESSONS));
    setYearPlans(prev => mergeById(prev, n.yearPlans));
    setDailyLogs(prev => mergeById(prev, n.dailyLogs));
    setWorkSamples(prev => mergeById(prev, n.workSamples));
    setActivities(prev => mergeById(prev, n.activities));
    setAttendance(prev => mergeById(prev, n.attendance));
    setAssignments(prev => mergeById(prev, n.assignments));
    setObservations(prev => mergeById(prev, n.observations));
    setStandards(prev => mergeById(prev, n.standards));
    setTestPrepSets(prev => mergeById(prev, n.testPrepSets));
    setReadingAnalyses(prev => mergeById(prev, n.readingAnalyses));
    return { students: n.students.length, lessons: n.lessons.length, yearPlans: n.yearPlans.length, dailyLogs: n.dailyLogs.length, records: recordCount };
  };

  const restoreFromDrive = async (): Promise<ImportSummary | null> => {
    const data = await restoreFromGoogleDrive();
    if (data === null) {
      return null;
    }
    return importBackup(data);
  };

  // Manual, user-initiated backup: allowed to re-open the Google popup if the
  // in-memory token has expired, and surfaces the real error to the caller.
  const backupNow = async () => {
    setIsBackingUp(true);
    setAutoBackupError(null);
    try {
      await backupToGoogleDrive(buildPayload(), true);
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <StudentContext.Provider value={{
      students,
      selectedStudent,
      addStudent,
      updateStudent,
      deleteStudent,
      selectStudent,
      addAssessmentToStudent,
      lessons,
      saveLesson,
      updateLesson,
      deleteLesson,
      yearPlans,
      upsertYearPlanQuarter,
      toggleWeekComplete,
      deleteYearPlan,
      dailyLogs,
      saveDailyLog,
      deleteDailyLog,
      workSamples,
      addWorkSample,
      updateWorkSample,
      deleteWorkSample,
      activities,
      addActivity,
      updateActivity,
      deleteActivity,
      attendance,
      setAttendanceMark,
      deleteAttendanceMark,
      assignments,
      addAssignment,
      updateAssignment,
      deleteAssignment,
      observations,
      addObservation,
      deleteObservation,
      standards,
      addStandards,
      updateStandard,
      deleteStandard,
      testPrepSets,
      addTestPrepSet,
      updateTestPrepSet,
      deleteTestPrepSet,
      readingAnalyses,
      addReadingAnalysis,
      deleteReadingAnalysis,
      exportBackup,
      importBackup,
      restoreFromDrive,
      backupNow,
      isAutoBackupEnabled,
      setAutoBackupEnabled: setIsAutoBackupEnabled,
      googleUser,
      loginGoogle,
      logoutGoogle,
      isBackingUp,
      autoBackupError
    }}>
      {children}
    </StudentContext.Provider>
  );
}

export function useStudents() {
  const context = useContext(StudentContext);
  if (context === undefined) {
    throw new Error('useStudents must be used within a StudentProvider');
  }
  return context;
}
