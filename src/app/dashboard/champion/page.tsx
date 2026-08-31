"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useMockStore } from "@/lib/mock-store";
import {
  getCohortStats,
  getAllMentees,
  getAllMentors,
  getAllAssignments,
  getSubmissionsForMentor,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  saveMentor,
} from "@/lib/firestore-helpers";
import type {
  Assignment,
  Mentee,
  Mentor,
  Submission,
  MenteeStatus,
  MentorSubmissionStatus,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/firestore-schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMenteeStatus(assignment: Assignment, submission: Submission | null): MenteeStatus {
  if (!submission) return Date.now() > assignment.dueDate ? "OVERDUE" : "TODO";
  if (submission.mentorStatus === "REWORK_REQUESTED") return "REWORK";
  return "COMPLETED";
}

function statusBadgeClass(status: MenteeStatus) {
  const map: Record<MenteeStatus, string> = {
    TODO: "border-slate-200 bg-slate-100 text-slate-600",
    OVERDUE: "border-rose-200 bg-rose-50 text-rose-700",
    COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REWORK: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return `text-xs font-semibold px-2 py-0.5 rounded-full border ${map[status]}`;
}

function mentorStatusBadgeClass(status: MentorSubmissionStatus) {
  const map: Record<MentorSubmissionStatus, string> = {
    PENDING: "border-sky-200 bg-sky-50 text-sky-700",
    EVALUATED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REWORK_REQUESTED: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return `text-xs font-semibold px-2 py-0.5 rounded-full border ${map[status]}`;
}

function riskBadgeClass(risk: "Low" | "Medium" | "High") {
  return `text-xs font-semibold px-2 py-0.5 rounded-full border ${
    risk === "High"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : risk === "Medium"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700"
  }`;
}

function priorityBadgeClass(priority: TaskPriority) {
  const map: Record<TaskPriority, string> = {
    Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Medium: "border-amber-200 bg-amber-50 text-amber-700",
    High: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return `text-xs font-semibold px-2 py-0.5 rounded-full border ${map[priority]}`;
}

function taskStatusBadgeClass(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    TODO: "border-slate-200 bg-slate-100 text-slate-600",
    IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-700",
    DONE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return `text-xs font-semibold px-2 py-0.5 rounded-full border ${map[status]}`;
}

const SCORE_KEYS = ["technicalPerformance", "communicationSkills", "projectEngagement", "independenceLevel"] as const;
type ScoreKey = (typeof SCORE_KEYS)[number];
const SCORE_DISPLAY: Record<ScoreKey, string> = {
  technicalPerformance: "Technical",
  communicationSkills: "Communication",
  projectEngagement: "Engagement",
  independenceLevel: "Independence",
};

const EMPTY_FORM = { title: "", description: "", dueDate: "", assignedMentees: [] as string[] };
const EMPTY_TASK_FORM = { title: "", description: "", priority: "Medium" as TaskPriority, dueDate: "" };
const MENTOR_CAPACITY = 5;

type ActiveTab = "assignments" | "tasks" | "mentors" | "risk" | "updates";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChampionDashboard() {
  const { user, firebaseConfigured } = useAuth();
  const mockStore = useMockStore();

  const [stats, setStats] = useState({ totalMentees: 0, avgCompletion: 0, avgConfidence: 0, highRiskCount: 0, mentorUtilization: 0 });
  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [fsAssignments, setFsAssignments] = useState<Assignment[]>([]);
  const [fsSubmissions, setFsSubmissions] = useState<Submission[]>([]);
  const [fsMentors, setFsMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);

  const assignments = firebaseConfigured ? fsAssignments : mockStore.assignments;
  const submissions = firebaseConfigured ? fsSubmissions : mockStore.submissions;
  const mentors = firebaseConfigured ? fsMentors : mockStore.mentors;
  const weeklyUpdates = mockStore.weeklyUpdates;
  const allFeedback = mockStore.feedback;

  const [activeTab, setActiveTab] = useState<ActiveTab>("assignments");

  // Assignment form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Task form
  const [fsTasks, setFsTasks] = useState<Task[]>([]);
  const [taskShowForm, setTaskShowForm] = useState(false);
  const [taskEditingId, setTaskEditingId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskDeleteConfirmId, setTaskDeleteConfirmId] = useState<string | null>(null);
  const tasks = firebaseConfigured ? fsTasks : mockStore.tasks;

  // Mentee profile modal
  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(null);

  // Mentor reassignment
  const [reassignMenteeId, setReassignMenteeId] = useState<string | null>(null);
  const [reassignToMentorId, setReassignToMentorId] = useState<string>("");

  // Updates filter
  const [updateFilterMenteeId, setUpdateFilterMenteeId] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const [s, m, ments] = await Promise.all([getCohortStats(), getAllMentees(), getAllMentors()]);
      setStats(s);
      setMentees(m);
      if (firebaseConfigured) {
        setFsMentors(ments);
        const [a, t, subs] = await Promise.all([
          getAllAssignments(),
          getAllTasks(),
          getSubmissionsForMentor(m.map((x) => x.id)),
        ]);
        setFsAssignments(a);
        setFsTasks(t);
        setFsSubmissions(subs);
      }
      setLoading(false);
    }
    load();
  }, [firebaseConfigured]);

  // ── Assignment CRUD ──────────────────────────────────────────────────────────

  function openCreate() { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }

  function openEdit(a: Assignment) {
    setEditingId(a.id);
    setForm({ title: a.title, description: a.description, dueDate: new Date(a.dueDate).toISOString().split("T")[0], assignedMentees: a.assignedMentees });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title || !form.dueDate) return;
    setSaving(true);
    const now = Date.now();
    const data = { title: form.title, description: form.description, dueDate: new Date(form.dueDate).getTime(), assignedMentees: form.assignedMentees, createdBy: user?.uid ?? "champion", createdAt: now, updatedAt: now };
    try {
      if (!firebaseConfigured) {
        editingId ? mockStore.patchAssignment(editingId, data) : mockStore.addAssignment({ id: `assign-${Date.now()}`, ...data });
      } else {
        if (editingId) {
          await updateAssignment(editingId, data);
          setFsAssignments((p) => p.map((a) => (a.id === editingId ? { ...a, ...data } : a)));
        } else {
          const created = await createAssignment(data);
          setFsAssignments((p) => [...p, created]);
        }
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!firebaseConfigured) { mockStore.removeAssignment(id); }
    else { await deleteAssignment(id); setFsAssignments((p) => p.filter((a) => a.id !== id)); }
    setDeleteConfirmId(null);
  }

  function toggleMentee(id: string) {
    setForm((f) => ({ ...f, assignedMentees: f.assignedMentees.includes(id) ? f.assignedMentees.filter((x) => x !== id) : [...f.assignedMentees, id] }));
  }

  // ── Task CRUD ────────────────────────────────────────────────────────────────

  function openTaskCreate() { setTaskEditingId(null); setTaskForm(EMPTY_TASK_FORM); setTaskShowForm(true); }

  function openTaskEdit(t: Task) {
    setTaskEditingId(t.id);
    setTaskForm({ title: t.title, description: t.description, priority: t.priority, dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "" });
    setTaskShowForm(true);
  }

  async function handleTaskSave() {
    if (!taskForm.title) return;
    setTaskSaving(true);
    const now = Date.now();
    const data: Omit<Task, "id"> = { title: taskForm.title, description: taskForm.description, priority: taskForm.priority, status: taskEditingId ? (tasks.find((t) => t.id === taskEditingId)?.status ?? "TODO") : "TODO", ...(taskForm.dueDate ? { dueDate: new Date(taskForm.dueDate).getTime() } : {}), createdBy: user?.uid ?? "champion", createdAt: now, updatedAt: now };
    try {
      if (!firebaseConfigured) {
        taskEditingId ? mockStore.patchTask(taskEditingId, data) : mockStore.addTask({ id: `task-${Date.now()}`, ...data });
      } else {
        if (taskEditingId) { await updateTask(taskEditingId, data); setFsTasks((p) => p.map((t) => (t.id === taskEditingId ? { ...t, ...data } : t))); }
        else { const created = await createTask(data); setFsTasks((p) => [...p, created]); }
      }
      setTaskShowForm(false);
      setTaskForm(EMPTY_TASK_FORM);
    } finally { setTaskSaving(false); }
  }

  async function handleTaskDelete(id: string) {
    if (!firebaseConfigured) { mockStore.removeTask(id); }
    else { await deleteTask(id); setFsTasks((p) => p.filter((t) => t.id !== id)); }
    setTaskDeleteConfirmId(null);
  }

  async function handleTaskStatusChange(id: string, status: TaskStatus) {
    const now = Date.now();
    if (!firebaseConfigured) { mockStore.patchTask(id, { status, updatedAt: now }); }
    else { await updateTask(id, { status, updatedAt: now }); setFsTasks((p) => p.map((t) => (t.id === id ? { ...t, status, updatedAt: now } : t))); }
  }

  // ── Mentor reassignment ──────────────────────────────────────────────────────

  async function handleReassign() {
    if (!reassignMenteeId || !reassignToMentorId) return;
    const mentee = mentees.find((m) => m.id === reassignMenteeId);
    if (!mentee || mentee.mentorId === reassignToMentorId) { setReassignMenteeId(null); return; }
    const oldMentorId = mentee.mentorId;

    if (!firebaseConfigured) {
      const oldM = mentors.find((m) => m.id === oldMentorId);
      const newM = mentors.find((m) => m.id === reassignToMentorId);
      if (oldM) mockStore.patchMentor(oldMentorId, { menteeIds: oldM.menteeIds.filter((id) => id !== reassignMenteeId), updatedAt: Date.now() });
      if (newM) mockStore.patchMentor(reassignToMentorId, { menteeIds: [...newM.menteeIds, reassignMenteeId], updatedAt: Date.now() });
    } else {
      const oldM = mentors.find((m) => m.id === oldMentorId);
      const newM = mentors.find((m) => m.id === reassignToMentorId);
      if (oldM) await saveMentor({ ...oldM, menteeIds: oldM.menteeIds.filter((id) => id !== reassignMenteeId) });
      if (newM) await saveMentor({ ...newM, menteeIds: [...newM.menteeIds, reassignMenteeId] });
      setFsMentors((p) => p.map((m) => {
        if (m.id === oldMentorId) return { ...m, menteeIds: m.menteeIds.filter((id) => id !== reassignMenteeId) };
        if (m.id === reassignToMentorId) return { ...m, menteeIds: [...m.menteeIds, reassignMenteeId] };
        return m;
      }));
    }
    setMentees((p) => p.map((m) => m.id === reassignMenteeId ? { ...m, mentorId: reassignToMentorId } : m));
    setReassignMenteeId(null);
    setReassignToMentorId("");
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const isAllSelected = form.assignedMentees.length === 0;

  const metricCards = [
    { title: "Total mentees", value: stats.totalMentees, note: "Active in cohort" },
    { title: "Avg completion", value: `${stats.avgCompletion}%`, note: "Across all assignments" },
    { title: "High-risk mentees", value: stats.highRiskCount, note: "Need intervention" },
    { title: "Avg confidence", value: `${stats.avgConfidence}/5`, note: "Self-assessment score" },
  ];

  const selectedMentee = mentees.find((m) => m.id === selectedMenteeId) ?? null;
  const menteeFeedback = allFeedback.filter((f) => f.menteeId === selectedMenteeId).sort((a, b) => b.week - a.week);
  const menteeUpdates = weeklyUpdates.filter((w) => w.menteeId === selectedMenteeId).sort((a, b) => b.week - a.week);
  const latestFeedback = menteeFeedback[0] ?? null;

  const filteredUpdates = updateFilterMenteeId === "all"
    ? [...weeklyUpdates].sort((a, b) => b.week - a.week)
    : weeklyUpdates.filter((w) => w.menteeId === updateFilterMenteeId).sort((a, b) => b.week - a.week);

  const riskMentees = {
    high: mentees.filter((m) => m.riskLevel === "High"),
    medium: mentees.filter((m) => m.riskLevel === "Medium"),
    low: mentees.filter((m) => m.riskLevel === "Low"),
  };

  function getRiskFactors(mentee: Mentee): string[] {
    const factors: string[] = [];
    if (mentee.completionPercentage < 30) factors.push(`Low completion (${mentee.completionPercentage}%)`);
    if (mentee.confidenceScore <= 2) factors.push(`Low confidence (${mentee.confidenceScore}/5)`);
    const hasOverdue = assignments.some((a) => {
      const isAssigned = a.assignedMentees.length === 0 || a.assignedMentees.includes(mentee.id);
      if (!isAssigned) return false;
      const sub = submissions.find((s) => s.assignmentId === a.id && s.menteeId === mentee.id);
      return !sub && Date.now() > a.dueDate;
    });
    if (hasOverdue) factors.push("Overdue assignments");
    const lastUpdate = weeklyUpdates.filter((w) => w.menteeId === mentee.id).sort((a, b) => b.week - a.week)[0];
    if (lastUpdate && !lastUpdate.mentorPresent) factors.push("Mentor absent in last check-in");
    if (mentee.weeksEnrolled >= 3 && weeklyUpdates.filter((w) => w.menteeId === mentee.id).length === 0) {
      factors.push("No check-ins recorded");
    }
    return factors;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fff9eb_0%,#f4f7fb_42%,#eef3f8_100%)] flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff9eb_0%,#f4f7fb_42%,#eef3f8_100%)] text-slate-950">
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 space-y-8">

        {/* Header */}
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">Champion Dashboard</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">Program Overview</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Manage assignments, track mentee progress, and monitor cohort health.</p>
        </section>

        {/* Stats */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((c) => (
            <article key={c.title} className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{c.title}</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{c.value}</p>
              <p className="mt-2 text-sm text-slate-600">{c.note}</p>
            </article>
          ))}
        </section>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-2">
          {([
            ["assignments", `Assignments (${assignments.length})`],
            ["tasks", `Tasks (${tasks.length})`],
            ["mentors", `Mentors (${mentors.length})`],
            ["risk", `Risk & Health`],
            ["updates", `Weekly Updates (${weeklyUpdates.length})`],
          ] as [ActiveTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === tab
                  ? "bg-slate-950 text-white shadow"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
              {tab === "risk" && stats.highRiskCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold">{stats.highRiskCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Assignments tab ── */}
        {activeTab === "assignments" && (
          <section className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Assignment Management</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">All assignments ({assignments.length})</h2>
              </div>
              {!showForm && (
                <button onClick={openCreate} className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">
                  + Create assignment
                </button>
              )}
            </div>

            {showForm && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-900">{editingId ? "Edit assignment" : "New assignment"}</p>
                <input type="text" placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition" />
                <textarea placeholder="Description" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition resize-none" />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Due date</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition" />
                </div>

                {/* Mentee multi-select */}
                <div className="flex flex-col gap-1.5 relative">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Assign to</label>
                  <button type="button" onClick={() => setDropdownOpen((o) => !o)} className="w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-amber-400 transition flex items-center justify-between">
                    <span>{isAllSelected ? "All mentees" : `${form.assignedMentees.length} mentee${form.assignedMentees.length !== 1 ? "s" : ""} selected`}</span>
                    <span className="text-slate-400 text-xs">{dropdownOpen ? "▴" : "▾"}</span>
                  </button>
                  {dropdownOpen && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                      <button type="button" onClick={() => { setForm((f) => ({ ...f, assignedMentees: [] })); setDropdownOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-semibold border-b border-slate-100 transition hover:bg-amber-50 ${isAllSelected ? "text-amber-700 bg-amber-50" : "text-slate-700"}`}>
                        All mentees {isAllSelected && <span className="float-right text-amber-600">✓</span>}
                      </button>
                      {mentees.map((m) => (
                        <button key={m.id} type="button" onClick={() => toggleMentee(m.id)} className="w-full text-left px-4 py-2.5 text-sm transition hover:bg-slate-50 flex items-center justify-between">
                          <span className={form.assignedMentees.includes(m.id) ? "text-slate-950 font-medium" : "text-slate-600"}>{m.name}</span>
                          {form.assignedMentees.includes(m.id) && <span className="text-amber-600 text-xs">✓</span>}
                        </button>
                      ))}
                      <div className="px-4 py-2 border-t border-slate-100">
                        <button type="button" onClick={() => setDropdownOpen(false)} className="text-xs text-slate-500 hover:text-slate-700">Done</button>
                      </div>
                    </div>
                  )}
                  {!isAllSelected && form.assignedMentees.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {form.assignedMentees.map((id) => {
                        const m = mentees.find((x) => x.id === id);
                        return (
                          <span key={id} className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-0.5 text-xs font-medium text-amber-800">
                            {m?.name ?? id}
                            <button type="button" onClick={() => toggleMentee(id)} className="text-amber-500 hover:text-amber-700">×</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={handleSave} disabled={saving || !form.title || !form.dueDate} className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition">
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => { setShowForm(false); setDropdownOpen(false); }} className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3">
              {assignments.length === 0 && <p className="text-sm text-slate-500">No assignments yet.</p>}
              {assignments.map((a) => (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                    {a.description && <p className="mt-1 text-sm text-slate-600">{a.description}</p>}
                    <p className="mt-1 text-xs text-slate-400">Due {new Date(a.dueDate).toLocaleDateString()} · {a.assignedMentees.length === 0 ? "All mentees" : `${a.assignedMentees.length} mentee${a.assignedMentees.length !== 1 ? "s" : ""}`}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {deleteConfirmId === a.id ? (
                      <>
                        <button onClick={() => handleDelete(a.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">Confirm delete</button>
                        <button onClick={() => setDeleteConfirmId(null)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => openEdit(a)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white transition">Edit</button>
                        <button onClick={() => setDeleteConfirmId(a.id)} className="rounded-xl border border-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition">Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Assignment tracking table */}
        {activeTab === "assignments" && assignments.length > 0 && mentees.length > 0 && (
          <section className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)] overflow-x-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tracking</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Assignment × Mentee status</h2>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-slate-400" />Top badge — Mentee status</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-sky-400" />Bottom badge — Mentor review status</span>
            </div>
            <table className="mt-4 w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left pb-3 pr-6 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 whitespace-nowrap">Assignment</th>
                  {mentees.map((m) => (
                    <th key={m.id} className="pb-3 px-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 whitespace-nowrap">{m.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td className="py-4 pr-6 font-medium text-slate-900 whitespace-nowrap align-top">{a.title}</td>
                    {mentees.map((m) => {
                      const isAssigned = a.assignedMentees.length === 0 || a.assignedMentees.includes(m.id);
                      if (!isAssigned) return <td key={m.id} className="py-4 px-3 text-center align-top"><span className="text-xs text-slate-300">—</span></td>;
                      const subs = submissions.filter((s) => s.assignmentId === a.id && s.menteeId === m.id);
                      const latestSub = subs.length > 0 ? subs.sort((x, y) => y.version - x.version)[0] : null;
                      const menteeStatus = getMenteeStatus(a, latestSub);
                      return (
                        <td key={m.id} className="py-4 px-3 text-center align-top">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={statusBadgeClass(menteeStatus)}>{menteeStatus}</span>
                            {latestSub ? <span className={mentorStatusBadgeClass(latestSub.mentorStatus)}>{latestSub.mentorStatus.replace(/_/g, " ")}</span> : <span className="text-xs text-slate-300 px-2">no review</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Tasks tab ── */}
        {activeTab === "tasks" && (
          <section className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Task Management</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">My tasks ({tasks.length})</h2>
              </div>
              {!taskShowForm && (
                <button onClick={openTaskCreate} className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">+ Add task</button>
              )}
            </div>

            {taskShowForm && (
              <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/60 p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-900">{taskEditingId ? "Edit task" : "New task"}</p>
                <input type="text" placeholder="Title" value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition" />
                <textarea placeholder="Description (optional)" rows={3} value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition resize-none" />
                <div className="flex gap-4 flex-wrap">
                  <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Priority</label>
                    <select value={taskForm.priority} onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-sky-400 transition">
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Due date (optional)</label>
                    <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-sky-400 transition" />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={handleTaskSave} disabled={taskSaving || !taskForm.title} className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition">{taskSaving ? "Saving…" : "Save"}</button>
                  <button onClick={() => setTaskShowForm(false)} className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3">
              {tasks.length === 0 && <p className="text-sm text-slate-500">No tasks yet.</p>}
              {tasks.map((t) => (
                <div key={t.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold ${t.status === "DONE" ? "line-through text-slate-400" : "text-slate-900"}`}>{t.title}</p>
                      <span className={priorityBadgeClass(t.priority)}>{t.priority}</span>
                      <span className={taskStatusBadgeClass(t.status)}>{t.status.replace("_", " ")}</span>
                    </div>
                    {t.description && <p className="mt-1 text-sm text-slate-600">{t.description}</p>}
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      {t.dueDate && <p className="text-xs text-slate-400">Due {new Date(t.dueDate).toLocaleDateString()}</p>}
                      <select value={t.status} onChange={(e) => handleTaskStatusChange(t.id, e.target.value as TaskStatus)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-sky-400 transition">
                        <option value="TODO">TODO</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="DONE">DONE</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {taskDeleteConfirmId === t.id ? (
                      <>
                        <button onClick={() => handleTaskDelete(t.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">Confirm delete</button>
                        <button onClick={() => setTaskDeleteConfirmId(null)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => openTaskEdit(t)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white transition">Edit</button>
                        <button onClick={() => setTaskDeleteConfirmId(t.id)} className="rounded-xl border border-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition">Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Mentors tab (EPIC3) ── */}
        {activeTab === "mentors" && (
          <section className="space-y-6">
            <div className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mentor Management</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Mentor roster ({mentors.length})</h2>
              <p className="mt-1 text-sm text-slate-500">View mentor utilization and reassign mentees between mentors.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {mentors.map((mentor) => {
                const assignedMentees = mentees.filter((m) => m.mentorId === mentor.id);
                const utilPct = Math.round((assignedMentees.length / MENTOR_CAPACITY) * 100);
                return (
                  <article key={mentor.id} className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                    {/* Mentor header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-950">{mentor.name}</p>
                        <p className="text-sm text-slate-500">{mentor.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700">{mentor.level}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">{mentor.domain}</span>
                          <span className="text-xs text-slate-500">{mentor.yearsOfExperience}y exp</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-slate-950">{assignedMentees.length}<span className="text-sm font-normal text-slate-400">/{MENTOR_CAPACITY}</span></p>
                        <p className="text-xs text-slate-500">mentees</p>
                      </div>
                    </div>

                    {/* Utilization bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Utilization</span>
                        <span className="text-xs font-semibold text-slate-700">{utilPct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${utilPct >= 80 ? "bg-rose-400" : utilPct >= 50 ? "bg-amber-400" : "bg-emerald-400"}`}
                          style={{ width: `${utilPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Avg confidence */}
                    <div className="mt-3 flex gap-4 text-xs text-slate-500">
                      <span>Avg confidence: <strong className="text-slate-800">{mentor.avgMenteeConfidence}/5</strong></span>
                      <span>Comm rating: <strong className="text-slate-800">{mentor.communicationRating}/5</strong></span>
                    </div>

                    {/* Mentee roster */}
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Mentees</p>
                      {assignedMentees.length === 0 && <p className="text-sm text-slate-400 italic">No mentees assigned</p>}
                      {assignedMentees.map((mentee) => (
                        <div key={mentee.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <button onClick={() => setSelectedMenteeId(mentee.id)} className="text-sm font-medium text-slate-900 hover:text-amber-700 hover:underline truncate text-left">
                              {mentee.name}
                            </button>
                            <span className={riskBadgeClass(mentee.riskLevel)}>{mentee.riskLevel}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-400">{mentee.track}</span>
                            {reassignMenteeId === mentee.id ? (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={reassignToMentorId}
                                  onChange={(e) => setReassignToMentorId(e.target.value)}
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-amber-400"
                                >
                                  <option value="">Pick mentor…</option>
                                  {mentors.filter((m) => m.id !== mentor.id).map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                </select>
                                <button onClick={handleReassign} disabled={!reassignToMentorId} className="rounded-lg bg-slate-950 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 transition">Move</button>
                                <button onClick={() => { setReassignMenteeId(null); setReassignToMentorId(""); }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 transition">✕</button>
                              </div>
                            ) : (
                              <button onClick={() => { setReassignMenteeId(mentee.id); setReassignToMentorId(""); }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-white hover:border-amber-300 transition">
                                Reassign
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Risk & Health tab (EPIC4) ── */}
        {activeTab === "risk" && (
          <section className="space-y-6">
            {/* Summary row */}
            <div className="grid gap-4 sm:grid-cols-3">
              {(["High", "Medium", "Low"] as const).map((level) => (
                <div key={level} className={`rounded-[1.5rem] border p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] ${level === "High" ? "border-rose-200 bg-rose-50" : level === "Medium" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${level === "High" ? "text-rose-600" : level === "Medium" ? "text-amber-600" : "text-emerald-600"}`}>{level} Risk</p>
                  <p className={`mt-2 text-4xl font-bold ${level === "High" ? "text-rose-700" : level === "Medium" ? "text-amber-700" : "text-emerald-700"}`}>{riskMentees[level.toLowerCase() as "high" | "medium" | "low"].length}</p>
                  <p className="mt-1 text-sm text-slate-600">mentees</p>
                </div>
              ))}
            </div>

            {/* High risk */}
            {riskMentees.high.length > 0 && (
              <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50/60 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">Critical — Immediate Intervention Required</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">High-risk mentees</h2>
                <div className="mt-4 space-y-4">
                  {riskMentees.high.map((mentee) => {
                    const factors = getRiskFactors(mentee);
                    const mentor = mentors.find((m) => m.id === mentee.mentorId);
                    return (
                      <div key={mentee.id} className="rounded-2xl border border-rose-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setSelectedMenteeId(mentee.id)} className="text-base font-bold text-slate-950 hover:text-rose-700 hover:underline">{mentee.name}</button>
                              <span className={riskBadgeClass("High")}>High</span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">{mentee.track} · Week {mentee.weeksEnrolled} · Mentor: {mentor?.name ?? mentee.mentorId}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {factors.map((f) => (
                                <span key={f} className="text-xs font-medium px-2 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-rose-700">{f}</span>
                              ))}
                              {factors.length === 0 && <span className="text-xs text-slate-400">Risk flag set manually</span>}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-slate-500">Confidence</p>
                            <p className="text-xl font-bold text-rose-700">{mentee.confidenceScore}/5</p>
                            <p className="text-xs text-slate-500 mt-1">Completion</p>
                            <p className="text-base font-bold text-slate-800">{mentee.completionPercentage}%</p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedMenteeId(mentee.id)} className="mt-3 rounded-xl border border-rose-200 px-4 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">
                          View profile →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Medium risk */}
            {riskMentees.medium.length > 0 && (
              <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50/60 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Watch — Monitor Closely</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Medium-risk mentees</h2>
                <div className="mt-4 space-y-4">
                  {riskMentees.medium.map((mentee) => {
                    const factors = getRiskFactors(mentee);
                    const mentor = mentors.find((m) => m.id === mentee.mentorId);
                    return (
                      <div key={mentee.id} className="rounded-2xl border border-amber-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setSelectedMenteeId(mentee.id)} className="text-base font-bold text-slate-950 hover:text-amber-700 hover:underline">{mentee.name}</button>
                              <span className={riskBadgeClass("Medium")}>Medium</span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">{mentee.track} · Week {mentee.weeksEnrolled} · Mentor: {mentor?.name ?? mentee.mentorId}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {factors.map((f) => (
                                <span key={f} className="text-xs font-medium px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">{f}</span>
                              ))}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-slate-500">Confidence</p>
                            <p className="text-xl font-bold text-amber-700">{mentee.confidenceScore}/5</p>
                            <p className="text-xs text-slate-500 mt-1">Completion</p>
                            <p className="text-base font-bold text-slate-800">{mentee.completionPercentage}%</p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedMenteeId(mentee.id)} className="mt-3 rounded-xl border border-amber-200 px-4 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition">
                          View profile →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Low risk */}
            {riskMentees.low.length > 0 && (
              <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50/40 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">On Track</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Low-risk mentees</h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {riskMentees.low.map((mentee) => (
                    <button key={mentee.id} onClick={() => setSelectedMenteeId(mentee.id)} className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 hover:shadow-md transition">
                      <span className="text-sm font-semibold text-slate-900">{mentee.name}</span>
                      <span className="text-xs text-slate-400">{mentee.completionPercentage}% · {mentee.confidenceScore}/5</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Weekly Updates tab (EPIC2 champion view) ── */}
        {activeTab === "updates" && (
          <section className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Program Updates</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Weekly check-ins ({weeklyUpdates.length})</h2>
              </div>
              <select
                value={updateFilterMenteeId}
                onChange={(e) => setUpdateFilterMenteeId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-amber-400 transition"
              >
                <option value="all">All mentees</option>
                {mentees.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div className="mt-6 space-y-4">
              {filteredUpdates.length === 0 && <p className="text-sm text-slate-500">No weekly updates recorded yet.</p>}
              {filteredUpdates.map((wu) => {
                const mentee = mentees.find((m) => m.id === wu.menteeId);
                const mentor = mentors.find((m) => m.id === wu.mentorId);
                return (
                  <div key={wu.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setSelectedMenteeId(wu.menteeId)} className="text-sm font-bold text-slate-900 hover:text-amber-700 hover:underline">{mentee?.name ?? wu.menteeId}</button>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">Week {wu.week}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">Mentor: {mentor?.name ?? wu.mentorId}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${wu.menteeAttendance === "Present" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : wu.menteeAttendance === "Absent" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                          {wu.menteeAttendance}
                        </span>
                        {!wu.mentorPresent && <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-100 text-slate-500">Mentor absent</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Confidence</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < wu.confidenceLevel ? "bg-amber-400" : "bg-slate-200"}`} />
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-slate-700">{wu.confidenceLevel}/5</span>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {wu.wins && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-600">Wins</p>
                          <p className="mt-1 text-sm text-slate-700">{wu.wins}</p>
                        </div>
                      )}
                      {wu.blockers && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-rose-600">Blockers</p>
                          <p className="mt-1 text-sm text-slate-700">{wu.blockers}</p>
                        </div>
                      )}
                      {wu.nextWeekFocus && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-600">Next week</p>
                          <p className="mt-1 text-sm text-slate-700">{wu.nextWeekFocus}</p>
                        </div>
                      )}
                    </div>

                    {wu.assignmentsCompleted.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Completed assignments</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {wu.assignmentsCompleted.map((aid) => {
                            const a = assignments.find((x) => x.id === aid);
                            return <span key={aid} className="text-xs px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">{a?.title ?? aid}</span>;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </main>

      {/* ── Mentee Profile Modal (EPIC4) ── */}
      {selectedMentee && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setSelectedMenteeId(null); }}>
          <div className="relative w-full max-w-2xl rounded-[2rem] border border-white/80 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.18)] my-8">
            {/* Modal header */}
            <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-950">{selectedMentee.name}</h2>
                  <span className={riskBadgeClass(selectedMentee.riskLevel)}>{selectedMentee.riskLevel} Risk</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{selectedMentee.email}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{selectedMentee.track}</span>
                  <span>·</span>
                  <span>Week {selectedMentee.weeksEnrolled}</span>
                  <span>·</span>
                  <span>Mentor: {mentors.find((m) => m.id === selectedMentee.mentorId)?.name ?? selectedMentee.mentorId}</span>
                </div>
              </div>
              <button onClick={() => setSelectedMenteeId(null)} className="shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Close</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Confidence</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{selectedMentee.confidenceScore}<span className="text-sm font-normal text-slate-400">/5</span></p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Completion</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{selectedMentee.completionPercentage}<span className="text-sm font-normal text-slate-400">%</span></p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Check-ins</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{menteeUpdates.length}</p>
                </div>
              </div>

              {/* Latest feedback scores */}
              {latestFeedback ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3">Latest Feedback — Week {latestFeedback.week}</p>
                  <div className="space-y-2.5">
                    {SCORE_KEYS.map((key) => {
                      const val = latestFeedback[key] as number;
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 text-xs font-medium text-slate-600">{SCORE_DISPLAY[key]}</span>
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${val >= 4 ? "bg-emerald-400" : val === 3 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${(val / 5) * 100}%` }} />
                          </div>
                          <span className="w-8 text-right text-xs font-bold text-slate-700">{val}/5</span>
                        </div>
                      );
                    })}
                  </div>
                  {latestFeedback.notes && <p className="mt-3 text-sm text-slate-600 italic">"{latestFeedback.notes}"</p>}
                  {latestFeedback.strengths.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-emerald-600 mb-1">Strengths</p>
                      <div className="flex flex-wrap gap-1.5">
                        {latestFeedback.strengths.map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">{s}</span>)}
                      </div>
                    </div>
                  )}
                  {latestFeedback.areasForImprovement.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-amber-600 mb-1">Areas for improvement</p>
                      <div className="flex flex-wrap gap-1.5">
                        {latestFeedback.areasForImprovement.map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">{s}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No mentor feedback recorded yet.</p>
              )}

              {/* Assignment status */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3">Assignment Status</p>
                {assignments.length === 0 && <p className="text-sm text-slate-400 italic">No assignments created.</p>}
                <div className="space-y-2">
                  {assignments.map((a) => {
                    const isAssigned = a.assignedMentees.length === 0 || a.assignedMentees.includes(selectedMentee.id);
                    if (!isAssigned) return null;
                    const sub = submissions.find((s) => s.assignmentId === a.id && s.menteeId === selectedMentee.id) ?? null;
                    const status = getMenteeStatus(a, sub);
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-sm text-slate-800">{a.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={statusBadgeClass(status)}>{status}</span>
                          {sub && <span className={mentorStatusBadgeClass(sub.mentorStatus)}>{sub.mentorStatus.replace(/_/g, " ")}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Weekly update history */}
              {menteeUpdates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3">Check-in History</p>
                  <div className="space-y-3">
                    {menteeUpdates.map((wu) => (
                      <div key={wu.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900">Week {wu.week}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${wu.menteeAttendance === "Present" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : wu.menteeAttendance === "Absent" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{wu.menteeAttendance}</span>
                            <span className="text-xs text-slate-500">Confidence: {wu.confidenceLevel}/5</span>
                          </div>
                        </div>
                        {wu.wins && <p className="mt-2 text-xs text-slate-600"><span className="font-semibold text-emerald-600">Win:</span> {wu.wins}</p>}
                        {wu.blockers && wu.blockers !== "None." && <p className="mt-1 text-xs text-slate-600"><span className="font-semibold text-rose-600">Blockers:</span> {wu.blockers}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
