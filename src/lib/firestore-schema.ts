export type Mentee = {
  id: string;
  name: string;
  email: string;
  track: "Training" | "Billable";
  mentorId: string;
  weeksEnrolled: number;
  confidenceScore: number;
  completionPercentage: number;
  riskLevel: "Low" | "Medium" | "High";
  createdAt: number;
  updatedAt: number;
};

export type Mentor = {
  id: string;
  name: string;
  email: string;
  level: "A2" | "A3" | "A4";
  yearsAtEpam: number;
  menteeIds: string[];
  communicationRating: number;
  yearsOfExperience: number;
  domain: string;
  avgMenteeConfidence: number;
  createdAt: number;
  updatedAt: number;
};

export type Assignment = {
  id: string;
  title: string;
  description: string;
  dueDate: number;           // unix ms timestamp
  assignedMentees: string[]; // mentee IDs; empty array = all mentees
  createdBy: string;         // champion uid
  createdAt: number;
  updatedAt: number;
};

export type Submission = {
  id: string;
  assignmentId: string;
  menteeId: string;
  version: number;
  fileUrls: string[];
  submittedAt: number;
  mentorStatus: "PENDING" | "EVALUATED" | "REWORK_REQUESTED";
  mentorNote?: string;
  evaluatedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type MenteeStatus = "TODO" | "COMPLETED" | "OVERDUE" | "REWORK";
export type MentorSubmissionStatus = "PENDING" | "EVALUATED" | "REWORK_REQUESTED";

export type WeeklyUpdate = {
  id: string;
  menteeId: string;
  mentorId: string;
  week: number;
  assignmentsCompleted: string[];
  blockers: string;
  wins: string;
  confidenceLevel: number;
  nextWeekFocus: string;
  mentorPresent: boolean;
  menteeAttendance: "Present" | "Absent" | "Excused";
  createdAt: number;
  updatedAt: number;
};

export type MentorFeedback = {
  id: string;
  menteeId: string;
  mentorId: string;
  week: number;
  technicalPerformance: number;
  communicationSkills: number;
  projectEngagement: number;
  independenceLevel: number;
  notes: string;
  areasForImprovement: string[];
  strengths: string[];
  createdAt: number;
  updatedAt: number;
};

export type User = {
  uid: string;
  email: string;
  role: "champion" | "mentor" | "mentee";
  name: string;
  createdAt: number;
};

export type TaskPriority = "Low" | "Medium" | "High";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export type Task = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export const COLLECTIONS = {
  MENTEES: "mentees",
  MENTORS: "mentors",
  ASSIGNMENTS: "assignments",
  SUBMISSIONS: "submissions",
  WEEKLY_UPDATES: "weekly_updates",
  MENTOR_FEEDBACK: "mentor_feedback",
  USERS: "users",
  TASKS: "tasks",
} as const;
