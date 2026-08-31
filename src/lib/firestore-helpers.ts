import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import {
  COLLECTIONS,
  type Mentee,
  type Mentor,
  type Assignment,
  type Submission,
  type WeeklyUpdate,
  type MentorFeedback,
  type User,
  type Task,
} from "./firestore-schema";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

export const mockMentees: Mentee[] = [
  {
    id: "mentee-001",
    name: "Ananya R.",
    email: "ananya.r@epam.com",
    track: "Training",
    mentorId: "mentor-001",
    weeksEnrolled: 3,
    confidenceScore: 3,
    completionPercentage: 22,
    riskLevel: "Medium",
    createdAt: Date.now() - 21 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
  {
    id: "mentee-002",
    name: "Sai K.",
    email: "sai.k@epam.com",
    track: "Billable",
    mentorId: "mentor-002",
    weeksEnrolled: 5,
    confidenceScore: 4,
    completionPercentage: 46,
    riskLevel: "Low",
    createdAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
  {
    id: "mentee-003",
    name: "Harini V.",
    email: "harini.v@epam.com",
    track: "Training",
    mentorId: "mentor-001",
    weeksEnrolled: 4,
    confidenceScore: 2,
    completionPercentage: 31,
    riskLevel: "High",
    createdAt: Date.now() - 28 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
  {
    id: "mentee-004",
    name: "Vikram N.",
    email: "vikram.n@epam.com",
    track: "Training",
    mentorId: "mentor-002",
    weeksEnrolled: 2,
    confidenceScore: 3,
    completionPercentage: 15,
    riskLevel: "Medium",
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
  {
    id: "mentee-005",
    name: "Deepa M.",
    email: "deepa.m@epam.com",
    track: "Billable",
    mentorId: "mentor-002",
    weeksEnrolled: 6,
    confidenceScore: 5,
    completionPercentage: 72,
    riskLevel: "Low",
    createdAt: Date.now() - 42 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
];

export const mockMentors: Mentor[] = [
  {
    id: "mentor-001",
    name: "Rakesh P.",
    email: "rakesh.p@epam.com",
    level: "A3",
    yearsAtEpam: 4,
    menteeIds: ["mentee-001", "mentee-003"],
    communicationRating: 4.5,
    yearsOfExperience: 6,
    domain: "Backend/Java",
    avgMenteeConfidence: 2.5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mentor-002",
    name: "Madhavi S.",
    email: "madhavi.s@epam.com",
    level: "A3",
    yearsAtEpam: 3,
    menteeIds: ["mentee-002", "mentee-004", "mentee-005"],
    communicationRating: 4.8,
    yearsOfExperience: 5,
    domain: "Frontend/React",
    avgMenteeConfidence: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const mockAssignments: Assignment[] = [
  {
    id: "assign-001",
    title: "Status Update Email",
    description: "Draft a professional weekly status update email covering progress, blockers, and next steps.",
    dueDate: Date.now() + 3 * 24 * 60 * 60 * 1000,
    assignedMentees: [],
    createdBy: "champion-001",
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "assign-002",
    title: "2-Minute Standup Recording",
    description: "Record a 2-minute standup video covering what you did, what you plan to do, and any blockers.",
    dueDate: Date.now() - 2 * 24 * 60 * 60 * 1000,
    assignedMentees: [],
    createdBy: "champion-001",
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
  },
];

export const mockSubmissions: Submission[] = [
  {
    id: "sub-001",
    assignmentId: "assign-001",
    menteeId: "mentee-002",
    version: 1,
    fileUrls: ["mock-file-url-1.pdf"],
    submittedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    mentorStatus: "PENDING",
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    id: "sub-002",
    assignmentId: "assign-002",
    menteeId: "mentee-001",
    version: 1,
    fileUrls: ["mock-file-url-2.mp4"],
    submittedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    mentorStatus: "REWORK_REQUESTED",
    mentorNote: "Good effort! Please re-record with better audio quality and be more specific about blockers.",
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
];

export const mockWeeklyUpdates: WeeklyUpdate[] = [
  {
    id: "wu-001",
    menteeId: "mentee-001",
    mentorId: "mentor-001",
    week: 3,
    assignmentsCompleted: ["assign-001"],
    blockers: "Struggling with standup format and keeping it concise.",
    wins: "Completed the status update email draft and got positive feedback.",
    confidenceLevel: 3,
    nextWeekFocus: "Practice standup recording",
    mentorPresent: true,
    menteeAttendance: "Present",
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "wu-002",
    menteeId: "mentee-002",
    mentorId: "mentor-002",
    week: 5,
    assignmentsCompleted: ["assign-001", "assign-002"],
    blockers: "No major blockers this week.",
    wins: "Delivered a clean 2-minute standup, mentor gave strong feedback.",
    confidenceLevel: 4,
    nextWeekFocus: "Deep dive into billable project code review",
    mentorPresent: true,
    menteeAttendance: "Present",
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "wu-003",
    menteeId: "mentee-003",
    mentorId: "mentor-001",
    week: 4,
    assignmentsCompleted: [],
    blockers: "Low confidence on delivery, struggled to keep attention during standup.",
    wins: "Attempted the standup assignment for the first time.",
    confidenceLevel: 2,
    nextWeekFocus: "Re-attempt standup with mentor guidance",
    mentorPresent: false,
    menteeAttendance: "Present",
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "wu-004",
    menteeId: "mentee-005",
    mentorId: "mentor-002",
    week: 6,
    assignmentsCompleted: ["assign-001", "assign-002"],
    blockers: "None.",
    wins: "Finished all assignments ahead of deadline, volunteered to help a fellow mentee.",
    confidenceLevel: 5,
    nextWeekFocus: "Begin advanced communication module",
    mentorPresent: true,
    menteeAttendance: "Present",
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
];

export const mockFeedback: MentorFeedback[] = [
  {
    id: "fb-001",
    menteeId: "mentee-001",
    mentorId: "mentor-001",
    week: 2,
    technicalPerformance: 3,
    communicationSkills: 4,
    projectEngagement: 3,
    independenceLevel: 3,
    notes: "Ananya shows good communication but needs more confidence in technical delivery.",
    areasForImprovement: ["Standup conciseness", "Technical vocabulary"],
    strengths: ["Written communication", "Eagerness to learn"],
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
  },
  {
    id: "fb-002",
    menteeId: "mentee-002",
    mentorId: "mentor-002",
    week: 4,
    technicalPerformance: 4,
    communicationSkills: 5,
    projectEngagement: 4,
    independenceLevel: 4,
    notes: "Sai is performing very well. Great communicator and takes ownership.",
    areasForImprovement: ["Could push harder on complex tasks"],
    strengths: ["Verbal communication", "Self-motivation", "Code quality"],
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
  },
  {
    id: "fb-003",
    menteeId: "mentee-003",
    mentorId: "mentor-001",
    week: 3,
    technicalPerformance: 2,
    communicationSkills: 3,
    projectEngagement: 2,
    independenceLevel: 2,
    notes: "Harini needs targeted support. Confidence is low and engagement is inconsistent.",
    areasForImprovement: ["Confidence building", "Assignment completion", "Proactive communication"],
    strengths: ["Willingness to receive feedback"],
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
  },
];

// ---------------------------------------------------------------------------
// User role
// ---------------------------------------------------------------------------

export async function getUserRole(uid: string): Promise<User["role"] | null> {
  if (!db) return null;
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    if (!docSnap.exists()) return null;
    return (docSnap.data() as User).role;
  } catch (error) {
    console.error("Error fetching user role:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mentees
// ---------------------------------------------------------------------------

export async function getMenteeByEmail(email: string): Promise<Mentee | null> {
  if (!db) {
    return mockMentees.find((m) => m.email === email) ?? mockMentees[0] ?? null;
  }
  try {
    const q = query(collection(db, COLLECTIONS.MENTEES), where("email", "==", email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as Mentee;
  } catch (error) {
    console.error("Error fetching mentee by email:", error);
    return mockMentees[0] ?? null;
  }
}

export async function getMenteeById(id: string): Promise<Mentee | null> {
  if (!db) return mockMentees.find((m) => m.id === id) ?? null;
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.MENTEES, id));
    return docSnap.exists() ? (docSnap.data() as Mentee) : null;
  } catch (error) {
    console.error("Error fetching mentee:", error);
    return mockMentees.find((m) => m.id === id) ?? null;
  }
}

export async function getAllMentees(filters?: { mentorId?: string; track?: "Training" | "Billable" }): Promise<Mentee[]> {
  if (!db) {
    let results = [...mockMentees];
    if (filters?.mentorId) results = results.filter((m) => m.mentorId === filters.mentorId);
    if (filters?.track) results = results.filter((m) => m.track === filters.track);
    return results;
  }
  try {
    let q = query(collection(db, COLLECTIONS.MENTEES));
    if (filters?.mentorId) q = query(collection(db, COLLECTIONS.MENTEES), where("mentorId", "==", filters.mentorId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as Mentee);
  } catch (error) {
    console.error("Error fetching mentees:", error);
    return mockMentees;
  }
}

export async function getMenteesByMentorId(mentorId: string): Promise<Mentee[]> {
  return getAllMentees({ mentorId });
}

export async function saveMentee(mentee: Mentee): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.MENTEES, mentee.id), { ...mentee, updatedAt: Timestamp.now() }, { merge: true });
  } catch (error) {
    console.error("Error saving mentee:", error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Mentors
// ---------------------------------------------------------------------------

export async function getMentorById(id: string): Promise<Mentor | null> {
  if (!db) return mockMentors.find((m) => m.id === id) ?? null;
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.MENTORS, id));
    return docSnap.exists() ? (docSnap.data() as Mentor) : null;
  } catch (error) {
    console.error("Error fetching mentor:", error);
    return mockMentors.find((m) => m.id === id) ?? null;
  }
}

export async function getAllMentors(): Promise<Mentor[]> {
  if (!db) return mockMentors;
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.MENTORS));
    return snapshot.docs.map((d) => d.data() as Mentor);
  } catch (error) {
    console.error("Error fetching mentors:", error);
    return mockMentors;
  }
}

export async function getMentorByEmail(email: string): Promise<Mentor | null> {
  if (!db) return mockMentors.find((m) => m.email === email) ?? mockMentors[0] ?? null;
  try {
    const q = query(collection(db, COLLECTIONS.MENTORS), where("email", "==", email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as Mentor;
  } catch (error) {
    console.error("Error fetching mentor by email:", error);
    return mockMentors[0] ?? null;
  }
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export async function getAllAssignments(): Promise<Assignment[]> {
  if (!db) return [...mockAssignments];
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.ASSIGNMENTS));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment));
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return [...mockAssignments];
  }
}

export async function getAssignmentsForMentee(menteeId: string): Promise<Assignment[]> {
  const all = await getAllAssignments();
  return all.filter((a) => a.assignedMentees.length === 0 || a.assignedMentees.includes(menteeId));
}

export async function createAssignment(data: Omit<Assignment, "id">): Promise<Assignment> {
  if (!db) {
    const mock: Assignment = { id: `assign-${Date.now()}`, ...data };
    mockAssignments.push(mock);
    return mock;
  }
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.ASSIGNMENTS), data);
    return { id: docRef.id, ...data };
  } catch (error) {
    console.error("Error creating assignment:", error);
    throw error;
  }
}

export async function updateAssignment(id: string, data: Partial<Omit<Assignment, "id">>): Promise<void> {
  if (!db) {
    const idx = mockAssignments.findIndex((a) => a.id === id);
    if (idx !== -1) Object.assign(mockAssignments[idx], data);
    return;
  }
  try {
    await setDoc(doc(db, COLLECTIONS.ASSIGNMENTS, id), { ...data, updatedAt: Date.now() }, { merge: true });
  } catch (error) {
    console.error("Error updating assignment:", error);
    throw error;
  }
}

export async function deleteAssignment(id: string): Promise<void> {
  if (!db) {
    const idx = mockAssignments.findIndex((a) => a.id === id);
    if (idx !== -1) mockAssignments.splice(idx, 1);
    return;
  }
  try {
    await deleteDoc(doc(db, COLLECTIONS.ASSIGNMENTS, id));
  } catch (error) {
    console.error("Error deleting assignment:", error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Tasks (champion personal task management)
// ---------------------------------------------------------------------------

export const mockTasks: Task[] = [
  {
    id: "task-001",
    title: "Schedule Week 4 Review",
    description: "Set up calendar invites for all mentee check-in sessions.",
    priority: "High",
    status: "TODO",
    dueDate: Date.now() + 2 * 24 * 60 * 60 * 1000,
    createdBy: "champion-001",
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    id: "task-002",
    title: "Onboard New Mentee Batch",
    description: "Prepare onboarding materials and send welcome emails to the next cohort.",
    priority: "Medium",
    status: "IN_PROGRESS",
    dueDate: Date.now() + 5 * 24 * 60 * 60 * 1000,
    createdBy: "champion-001",
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: "task-003",
    title: "Update Program Report",
    description: "Compile cohort progress metrics for monthly stakeholder report.",
    priority: "Low",
    status: "DONE",
    createdBy: "champion-001",
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
];

export async function getAllTasks(): Promise<Task[]> {
  if (!db) return [...mockTasks];
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.TASKS));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [...mockTasks];
  }
}

export async function createTask(data: Omit<Task, "id">): Promise<Task> {
  if (!db) {
    const mock: Task = { id: `task-${Date.now()}`, ...data };
    mockTasks.push(mock);
    return mock;
  }
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.TASKS), data);
    return { id: docRef.id, ...data };
  } catch (error) {
    console.error("Error creating task:", error);
    throw error;
  }
}

export async function updateTask(id: string, data: Partial<Omit<Task, "id">>): Promise<void> {
  if (!db) {
    const idx = mockTasks.findIndex((t) => t.id === id);
    if (idx !== -1) Object.assign(mockTasks[idx], data);
    return;
  }
  try {
    await setDoc(doc(db, COLLECTIONS.TASKS, id), { ...data, updatedAt: Date.now() }, { merge: true });
  } catch (error) {
    console.error("Error updating task:", error);
    throw error;
  }
}

export async function deleteTask(id: string): Promise<void> {
  if (!db) {
    const idx = mockTasks.findIndex((t) => t.id === id);
    if (idx !== -1) mockTasks.splice(idx, 1);
    return;
  }
  try {
    await deleteDoc(doc(db, COLLECTIONS.TASKS, id));
  } catch (error) {
    console.error("Error deleting task:", error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export async function getSubmissionsForMentee(menteeId: string): Promise<Submission[]> {
  if (!db) return mockSubmissions.filter((s) => s.menteeId === menteeId).map((s) => ({ ...s }));
  try {
    const q = query(collection(db, COLLECTIONS.SUBMISSIONS), where("menteeId", "==", menteeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Submission));
  } catch (error) {
    console.error("Error fetching submissions for mentee:", error);
    return [];
  }
}

export async function getSubmissionsForMentor(menteeIds: string[]): Promise<Submission[]> {
  if (!db) return mockSubmissions.filter((s) => menteeIds.includes(s.menteeId)).map((s) => ({ ...s }));
  if (menteeIds.length === 0) return [];
  try {
    const q = query(collection(db, COLLECTIONS.SUBMISSIONS), where("menteeId", "in", menteeIds));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Submission));
  } catch (error) {
    console.error("Error fetching submissions for mentor:", error);
    return [];
  }
}

export async function upsertSubmission(
  assignmentId: string,
  menteeId: string,
  fileUrls: string[],
  previousVersion: number
): Promise<void> {
  const now = Date.now();
  const data: Omit<Submission, "id"> = {
    assignmentId,
    menteeId,
    version: previousVersion + 1,
    fileUrls,
    submittedAt: now,
    mentorStatus: "PENDING",
    createdAt: now,
    updatedAt: now,
  };

  if (!db) {
    const idx = mockSubmissions.findIndex(
      (s) => s.assignmentId === assignmentId && s.menteeId === menteeId
    );
    if (idx !== -1) {
      Object.assign(mockSubmissions[idx], data);
    } else {
      mockSubmissions.push({ id: `sub-${Date.now()}`, ...data });
    }
    return;
  }

  try {
    const q = query(
      collection(db, COLLECTIONS.SUBMISSIONS),
      where("assignmentId", "==", assignmentId),
      where("menteeId", "==", menteeId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      await setDoc(snap.docs[0].ref, { ...data, updatedAt: Date.now() }, { merge: true });
    } else {
      await addDoc(collection(db, COLLECTIONS.SUBMISSIONS), data);
    }
  } catch (error) {
    console.error("Error upserting submission:", error);
    throw error;
  }
}

export async function updateSubmissionStatus(
  submissionId: string,
  mentorStatus: Submission["mentorStatus"],
  mentorNote?: string
): Promise<void> {
  const update: Partial<Submission> = {
    mentorStatus,
    updatedAt: Date.now(),
    ...(mentorStatus === "EVALUATED" ? { evaluatedAt: Date.now() } : {}),
    ...(mentorNote !== undefined ? { mentorNote } : {}),
  };

  if (!db) {
    const idx = mockSubmissions.findIndex((s) => s.id === submissionId);
    if (idx !== -1) Object.assign(mockSubmissions[idx], update);
    return;
  }
  try {
    await setDoc(doc(db, COLLECTIONS.SUBMISSIONS, submissionId), update, { merge: true });
  } catch (error) {
    console.error("Error updating submission status:", error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// File upload
// ---------------------------------------------------------------------------

export async function uploadSubmissionFiles(
  menteeId: string,
  assignmentId: string,
  version: number,
  files: File[]
): Promise<string[]> {
  if (!storage) {
    return files.map((f, i) => `mock-file-${i + 1}-${f.name}`);
  }
  const urls: string[] = [];
  for (const file of files) {
    const path = `submissions/${menteeId}/${assignmentId}/v${version}/${file.name}`;
    const storageRef = ref(storage, path);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    urls.push(url);
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Cohort stats (champion)
// ---------------------------------------------------------------------------

export async function getCohortStats(): Promise<{
  totalMentees: number;
  avgCompletion: number;
  avgConfidence: number;
  highRiskCount: number;
  mentorUtilization: number;
}> {
  const mentees = await getAllMentees();
  const mentors = await getAllMentors();
  const avgCompletion = mentees.length > 0 ? mentees.reduce((s, m) => s + m.completionPercentage, 0) / mentees.length : 0;
  const avgConfidence = mentees.length > 0 ? mentees.reduce((s, m) => s + m.confidenceScore, 0) / mentees.length : 0;
  const highRiskCount = mentees.filter((m) => m.riskLevel === "High").length;
  const totalMenteeSlots = mentors.reduce((s, m) => s + m.menteeIds.length, 0);
  const maxCapacity = mentors.length * 5;
  const mentorUtilization = maxCapacity > 0 ? (totalMenteeSlots / maxCapacity) * 100 : 0;
  return {
    totalMentees: mentees.length,
    avgCompletion: Math.round(avgCompletion),
    avgConfidence: Math.round(avgConfidence * 10) / 10,
    highRiskCount,
    mentorUtilization: Math.round(mentorUtilization),
  };
}

// ---------------------------------------------------------------------------
// Weekly updates & mentor feedback (unchanged)
// ---------------------------------------------------------------------------

export async function getWeeklyUpdatesForMentee(menteeId: string): Promise<WeeklyUpdate[]> {
  if (!db) return mockWeeklyUpdates.filter((w) => w.menteeId === menteeId).map((w) => ({ ...w }));
  try {
    const q = query(collection(db, COLLECTIONS.WEEKLY_UPDATES), where("menteeId", "==", menteeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as WeeklyUpdate));
  } catch (error) {
    console.error("Error fetching weekly updates:", error);
    return [];
  }
}

export async function createWeeklyUpdate(data: Omit<WeeklyUpdate, "id">): Promise<WeeklyUpdate> {
  if (!db) {
    const mock: WeeklyUpdate = { id: `wu-${Date.now()}`, ...data };
    mockWeeklyUpdates.push(mock);
    return mock;
  }
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.WEEKLY_UPDATES), data);
    return { id: docRef.id, ...data };
  } catch (error) {
    console.error("Error creating weekly update:", error);
    throw error;
  }
}

export async function getMentorFeedbackForMentee(menteeId: string): Promise<MentorFeedback[]> {
  if (!db) return mockFeedback.filter((f) => f.menteeId === menteeId).map((f) => ({ ...f }));
  try {
    const q = query(collection(db, COLLECTIONS.MENTOR_FEEDBACK), where("menteeId", "==", menteeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as MentorFeedback));
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return [];
  }
}

export async function saveMentorFeedback(data: Omit<MentorFeedback, "id">): Promise<MentorFeedback> {
  if (!db) {
    const existing = mockFeedback.findIndex(
      (f) => f.menteeId === data.menteeId && f.week === data.week
    );
    if (existing !== -1) {
      Object.assign(mockFeedback[existing], { ...data, updatedAt: Date.now() });
      return mockFeedback[existing];
    }
    const mock: MentorFeedback = { id: `fb-${Date.now()}`, ...data };
    mockFeedback.push(mock);
    return mock;
  }
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.MENTOR_FEEDBACK), data);
    return { id: docRef.id, ...data };
  } catch (error) {
    console.error("Error saving mentor feedback:", error);
    throw error;
  }
}

export async function saveMentor(mentor: Mentor): Promise<void> {
  if (!db) {
    const idx = mockMentors.findIndex((m) => m.id === mentor.id);
    if (idx !== -1) Object.assign(mockMentors[idx], { ...mentor, updatedAt: Date.now() });
    return;
  }
  try {
    await setDoc(doc(db, COLLECTIONS.MENTORS, mentor.id), { ...mentor, updatedAt: Date.now() }, { merge: true });
  } catch (error) {
    console.error("Error saving mentor:", error);
    throw error;
  }
}

