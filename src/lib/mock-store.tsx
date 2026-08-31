"use client";

import React, { createContext, useContext, useState } from "react";
import { mockAssignments, mockSubmissions, mockTasks, mockWeeklyUpdates, mockFeedback, mockMentors } from "./firestore-helpers";
import type { Assignment, Submission, Task, WeeklyUpdate, MentorFeedback, Mentor } from "./firestore-schema";

interface MockStore {
  assignments: Assignment[];
  submissions: Submission[];
  tasks: Task[];
  weeklyUpdates: WeeklyUpdate[];
  feedback: MentorFeedback[];
  mentors: Mentor[];
  addAssignment: (a: Assignment) => void;
  patchAssignment: (id: string, data: Partial<Assignment>) => void;
  removeAssignment: (id: string) => void;
  addSubmission: (s: Submission) => void;
  patchSubmission: (id: string, data: Partial<Submission>) => void;
  addTask: (t: Task) => void;
  patchTask: (id: string, data: Partial<Task>) => void;
  removeTask: (id: string) => void;
  addWeeklyUpdate: (w: WeeklyUpdate) => void;
  addFeedback: (f: MentorFeedback) => void;
  patchFeedback: (id: string, data: Partial<MentorFeedback>) => void;
  patchMentor: (id: string, data: Partial<Mentor>) => void;
}

const MockStoreContext = createContext<MockStore | null>(null);

export function MockStoreProvider({ children }: { children: React.ReactNode }) {
  const [assignments, setAssignments] = useState<Assignment[]>(() => [...mockAssignments]);
  const [submissions, setSubmissions] = useState<Submission[]>(() => [...mockSubmissions]);
  const [tasks, setTasks] = useState<Task[]>(() => [...mockTasks]);
  const [weeklyUpdates, setWeeklyUpdates] = useState<WeeklyUpdate[]>(() => [...mockWeeklyUpdates]);
  const [feedback, setFeedback] = useState<MentorFeedback[]>(() => [...mockFeedback]);
  const [mentors, setMentors] = useState<Mentor[]>(() => [...mockMentors]);

  return (
    <MockStoreContext.Provider
      value={{
        assignments,
        submissions,
        tasks,
        weeklyUpdates,
        feedback,
        mentors,
        addAssignment: (a) => setAssignments((p) => [...p, a]),
        patchAssignment: (id, data) =>
          setAssignments((p) => p.map((a) => (a.id === id ? { ...a, ...data } : a))),
        removeAssignment: (id) => setAssignments((p) => p.filter((a) => a.id !== id)),
        addSubmission: (s) =>
          setSubmissions((p) => {
            const without = p.filter(
              (x) => !(x.assignmentId === s.assignmentId && x.menteeId === s.menteeId)
            );
            return [...without, s];
          }),
        patchSubmission: (id, data) =>
          setSubmissions((p) => p.map((s) => (s.id === id ? { ...s, ...data } : s))),
        addTask: (t) => setTasks((p) => [...p, t]),
        patchTask: (id, data) =>
          setTasks((p) => p.map((t) => (t.id === id ? { ...t, ...data } : t))),
        removeTask: (id) => setTasks((p) => p.filter((t) => t.id !== id)),
        addWeeklyUpdate: (w) =>
          setWeeklyUpdates((p) => {
            const without = p.filter((x) => !(x.menteeId === w.menteeId && x.week === w.week));
            return [...without, w];
          }),
        addFeedback: (f) =>
          setFeedback((p) => {
            const without = p.filter((x) => !(x.menteeId === f.menteeId && x.week === f.week));
            return [...without, f];
          }),
        patchFeedback: (id, data) =>
          setFeedback((p) => p.map((f) => (f.id === id ? { ...f, ...data } : f))),
        patchMentor: (id, data) =>
          setMentors((p) => p.map((m) => (m.id === id ? { ...m, ...data } : m))),
      }}
    >
      {children}
    </MockStoreContext.Provider>
  );
}

export function useMockStore(): MockStore {
  const ctx = useContext(MockStoreContext);
  if (!ctx) throw new Error("useMockStore must be used within MockStoreProvider");
  return ctx;
}
