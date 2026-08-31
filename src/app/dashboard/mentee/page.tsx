"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useMockStore } from "@/lib/mock-store";
import {
  getMenteeByEmail,
  getMentorById,
  getMentorFeedbackForMentee,
  getAssignmentsForMentee,
  getSubmissionsForMentee,
  getWeeklyUpdatesForMentee,
  upsertSubmission,
  uploadSubmissionFiles,
  createWeeklyUpdate,
} from "@/lib/firestore-helpers";
import type {
  Mentee,
  Mentor,
  MentorFeedback,
  Assignment,
  Submission,
  MenteeStatus,
  WeeklyUpdate,
} from "@/lib/firestore-schema";

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
  return `text-xs font-semibold px-3 py-1 rounded-full border ${map[status]}`;
}

const SCORE_LABELS = [
  { key: "communicationSkills" as const, label: "Communication Skills" },
  { key: "technicalPerformance" as const, label: "Technical Performance" },
  { key: "projectEngagement" as const, label: "Project Engagement" },
  { key: "independenceLevel" as const, label: "Independence" },
];

const ATTENDANCE_OPTIONS: WeeklyUpdate["menteeAttendance"][] = ["Present", "Absent", "Excused"];

const EMPTY_UPDATE_FORM = {
  wins: "",
  blockers: "",
  nextWeekFocus: "",
  confidenceLevel: 3,
  mentorPresent: true,
  menteeAttendance: "Present" as WeeklyUpdate["menteeAttendance"],
};

export default function MenteeDashboard() {
  const { user, firebaseConfigured } = useAuth();
  const mockStore = useMockStore();

  const [mentee, setMentee] = useState<Mentee | null>(null);
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [latestFeedback, setLatestFeedback] = useState<MentorFeedback | null>(null);
  const [fsAssignments, setFsAssignments] = useState<Assignment[]>([]);
  const [fsSubmissions, setFsSubmissions] = useState<Submission[]>([]);
  const [weeklyUpdates, setWeeklyUpdates] = useState<WeeklyUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  const assignments = firebaseConfigured
    ? fsAssignments
    : mockStore.assignments.filter(
        (a) => a.assignedMentees.length === 0 || a.assignedMentees.includes(mentee?.id ?? "")
      );
  const submissions = firebaseConfigured
    ? fsSubmissions
    : mockStore.submissions.filter((s) => s.menteeId === (mentee?.id ?? ""));

  const [activeTab, setActiveTab] = useState<"assignments" | "checkin" | "feedback">("assignments");

  // Assignment submission state
  const [submitOpenId, setSubmitOpenId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Weekly check-in state
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [updateForm, setUpdateForm] = useState(EMPTY_UPDATE_FORM);
  const [checkinSaving, setCheckinSaving] = useState(false);
  const [completedAssignIds, setCompletedAssignIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.email) return;
    async function load() {
      try {
        const menteeData = await getMenteeByEmail(user!.email!);
        if (!menteeData) { setLoading(false); return; }
        setMentee(menteeData);

        const [mentorData, feedbackList, updates] = await Promise.all([
          getMentorById(menteeData.mentorId),
          getMentorFeedbackForMentee(menteeData.id),
          firebaseConfigured
            ? getWeeklyUpdatesForMentee(menteeData.id)
            : Promise.resolve(
                mockStore.weeklyUpdates.filter((w) => w.menteeId === menteeData.id)
              ),
        ]);
        setMentor(mentorData);
        if (feedbackList.length > 0) {
          setLatestFeedback(feedbackList.sort((a, b) => b.week - a.week)[0]);
        }
        setWeeklyUpdates(updates.sort((a, b) => b.week - a.week));

        if (firebaseConfigured) {
          const [assignmentList, submissionList] = await Promise.all([
            getAssignmentsForMentee(menteeData.id),
            getSubmissionsForMentee(menteeData.id),
          ]);
          setFsAssignments(assignmentList);
          setFsSubmissions(submissionList);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, firebaseConfigured]); // eslint-disable-line react-hooks/exhaustive-deps

  function getLatestSubmission(assignmentId: string): Submission | null {
    const subs = submissions.filter((s) => s.assignmentId === assignmentId);
    if (subs.length === 0) return null;
    return subs.sort((a, b) => b.version - a.version)[0];
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(e.target.files ?? []).slice(0, 5));
  }

  async function handleSubmit(assignmentId: string) {
    if (!mentee || selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const existing = getLatestSubmission(assignmentId);
      const prevVersion = existing?.version ?? 0;
      const urls = await uploadSubmissionFiles(mentee.id, assignmentId, prevVersion + 1, selectedFiles);
      const newSub: Submission = {
        id: `sub-${Date.now()}`,
        assignmentId,
        menteeId: mentee.id,
        version: prevVersion + 1,
        fileUrls: urls,
        submittedAt: Date.now(),
        mentorStatus: "PENDING",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (!firebaseConfigured) {
        mockStore.addSubmission(newSub);
      } else {
        await upsertSubmission(assignmentId, mentee.id, urls, prevVersion);
        setFsSubmissions((prev) => {
          const without = prev.filter(
            (s) => !(s.assignmentId === assignmentId && s.menteeId === mentee.id)
          );
          return [...without, newSub];
        });
      }
      setSubmitOpenId(null);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  async function handleCheckinSubmit() {
    if (!mentee) return;
    setCheckinSaving(true);
    const now = Date.now();
    const currentWeek = mentee.weeksEnrolled;
    const data: Omit<WeeklyUpdate, "id"> = {
      menteeId: mentee.id,
      mentorId: mentee.mentorId,
      week: currentWeek,
      assignmentsCompleted: completedAssignIds,
      blockers: updateForm.blockers,
      wins: updateForm.wins,
      confidenceLevel: updateForm.confidenceLevel,
      nextWeekFocus: updateForm.nextWeekFocus,
      mentorPresent: updateForm.mentorPresent,
      menteeAttendance: updateForm.menteeAttendance,
      createdAt: now,
      updatedAt: now,
    };
    try {
      let saved: WeeklyUpdate;
      if (!firebaseConfigured) {
        saved = { id: `wu-${Date.now()}`, ...data };
        mockStore.addWeeklyUpdate(saved);
      } else {
        saved = await createWeeklyUpdate(data);
      }
      setWeeklyUpdates((prev) => {
        const without = prev.filter((w) => w.week !== currentWeek);
        return [saved, ...without];
      });
      setShowCheckinForm(false);
      setUpdateForm(EMPTY_UPDATE_FORM);
      setCompletedAssignIds([]);
    } finally {
      setCheckinSaving(false);
    }
  }

  function toggleAssignmentCompleted(id: string) {
    setCompletedAssignIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fff9eb_0%,#f4f7fb_42%,#eef3f8_100%)] flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading your dashboard…</p>
      </div>
    );
  }

  if (!mentee) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fff9eb_0%,#f4f7fb_42%,#eef3f8_100%)] flex items-center justify-center">
        <p className="text-sm text-slate-500">No mentee profile found for this account.</p>
      </div>
    );
  }

  const completedCount = submissions.filter((s) => s.mentorStatus !== "REWORK_REQUESTED").length;

  const metrics = [
    { title: "Current week", value: `Week ${mentee.weeksEnrolled}`, note: "Program progress" },
    { title: "Assignments done", value: `${completedCount}/${assignments.length || "—"}`, note: "Based on your submissions" },
    { title: "Confidence score", value: `${mentee.confidenceScore}/5`, note: "From latest self-assessment" },
    { title: "Mentor", value: mentor?.name ?? "Assigned", note: mentor?.domain ?? "" },
  ];

  const latestUpdate = weeklyUpdates[0];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff9eb_0%,#f4f7fb_42%,#eef3f8_100%)] text-slate-950">
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 space-y-6">

        {/* Header */}
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">Mentee Dashboard</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            {mentee.name}&apos;s JAP Journey
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Stay on top of your assignments, weekly check-ins, and mentor feedback.
          </p>
        </section>

        {/* Stats */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((card) => (
            <article
              key={card.title}
              className="rounded-[1.5rem] border border-white/80 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{card.title}</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{card.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.note}</p>
            </article>
          ))}
        </section>

        {/* Tab bar */}
        <div className="flex gap-2 flex-wrap">
          {([
            ["assignments", `Assignments (${assignments.length})`],
            ["checkin", `Weekly Check-In${weeklyUpdates.length > 0 ? ` (${weeklyUpdates.length})` : ""}`],
            ["feedback", "Mentor Feedback"],
          ] as const).map(([tab, label]) => (
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
            </button>
          ))}
        </div>

        {/* Assignments tab */}
        {activeTab === "assignments" && (
          <section className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Your assignments</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              {assignments.length > 0
                ? `${assignments.length} assignment${assignments.length !== 1 ? "s" : ""}`
                : "No assignments yet"}
            </h2>

            {assignments.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">No assignments have been posted yet.</p>
            ) : (
              <div className="mt-6 space-y-4">
                {assignments.map((a) => {
                  const sub = getLatestSubmission(a.id);
                  const status = getMenteeStatus(a, sub);
                  const canSubmit = status === "TODO" || status === "OVERDUE" || status === "REWORK";
                  const isOpen = submitOpenId === a.id;

                  return (
                    <div key={a.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                          {a.description && <p className="mt-1 text-sm text-slate-600">{a.description}</p>}
                          <p className="mt-1 text-xs text-slate-400">
                            Due {new Date(a.dueDate).toLocaleDateString()}
                            {sub ? ` · v${sub.version} submitted` : ""}
                          </p>
                          {sub && sub.fileUrls.length > 0 && !isOpen && (
                            <ul className="mt-2 space-y-1">
                              {sub.fileUrls.map((url, i) => (
                                <li key={i}>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-sky-600 hover:text-sky-800 hover:underline transition"
                                  >
                                    {url.startsWith("mock") ? url : `Attachment ${i + 1}`}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <span className={statusBadgeClass(status)}>{status}</span>
                      </div>

                      {status === "REWORK" && sub?.mentorNote && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                          <p className="text-xs font-semibold text-amber-700 uppercase tracking-[0.15em]">Mentor note</p>
                          <p className="mt-1 text-sm text-amber-800">{sub.mentorNote}</p>
                        </div>
                      )}

                      {canSubmit && !isOpen && (
                        <button
                          onClick={() => { setSubmitOpenId(a.id); setSelectedFiles([]); }}
                          className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                        >
                          {sub ? "Re-submit" : "Submit"}
                        </button>
                      )}

                      {isOpen && (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <label className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                              Attach files (max 5)
                            </label>
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              onChange={handleFileChange}
                              className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                            />
                            {selectedFiles.length > 0 && (
                              <ul className="mt-3 space-y-1">
                                {selectedFiles.map((f, i) => (
                                  <li key={i} className="text-xs text-slate-600">· {f.name}</li>
                                ))}
                              </ul>
                            )}
                            {selectedFiles.length === 5 && (
                              <p className="mt-2 text-xs text-amber-600">Maximum of 5 files reached.</p>
                            )}
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleSubmit(a.id)}
                              disabled={uploading || selectedFiles.length === 0}
                              className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                            >
                              {uploading ? "Uploading…" : "Upload & submit"}
                            </button>
                            <button
                              onClick={() => { setSubmitOpenId(null); setSelectedFiles([]); }}
                              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-white transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Weekly Check-In tab */}
        {activeTab === "checkin" && (
          <section className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Weekly Check-In</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  Week {mentee.weeksEnrolled} update
                  {latestUpdate ? ` · Last submitted Week ${latestUpdate.week}` : ""}
                </h2>
              </div>
              {!showCheckinForm && (
                <button
                  onClick={() => setShowCheckinForm(true)}
                  className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
                >
                  + Submit check-in
                </button>
              )}
            </div>

            {showCheckinForm && (
              <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/60 p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-900">Week {mentee.weeksEnrolled} check-in</p>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Confidence level
                    </label>
                    <span className="text-xs font-bold text-sky-700">{updateForm.confidenceLevel}/5</span>
                  </div>
                  <input
                    type="range" min={1} max={5} step={1}
                    value={updateForm.confidenceLevel}
                    onChange={(e) => setUpdateForm((f) => ({ ...f, confidenceLevel: Number(e.target.value) }))}
                    className="w-full accent-sky-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>1 (low)</span><span>3 (ok)</span><span>5 (great)</span>
                  </div>
                </div>

                <textarea
                  placeholder="Wins this week"
                  rows={2}
                  value={updateForm.wins}
                  onChange={(e) => setUpdateForm((f) => ({ ...f, wins: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none transition"
                />
                <textarea
                  placeholder="Blockers or challenges"
                  rows={2}
                  value={updateForm.blockers}
                  onChange={(e) => setUpdateForm((f) => ({ ...f, blockers: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none transition"
                />
                <input
                  type="text"
                  placeholder="Next week focus"
                  value={updateForm.nextWeekFocus}
                  onChange={(e) => setUpdateForm((f) => ({ ...f, nextWeekFocus: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
                />

                <div className="flex gap-6 items-center flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="mentorPresent"
                      checked={updateForm.mentorPresent}
                      onChange={(e) => setUpdateForm((f) => ({ ...f, mentorPresent: e.target.checked }))}
                      className="accent-sky-600"
                    />
                    <label htmlFor="mentorPresent" className="text-sm text-slate-700">Mentor present</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Attendance
                    </label>
                    <select
                      value={updateForm.menteeAttendance}
                      onChange={(e) =>
                        setUpdateForm((f) => ({
                          ...f,
                          menteeAttendance: e.target.value as WeeklyUpdate["menteeAttendance"],
                        }))
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-sky-400"
                    >
                      {ATTENDANCE_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {assignments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Assignments completed this week
                    </p>
                    <div className="space-y-1">
                      {assignments.map((a) => (
                        <label key={a.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={completedAssignIds.includes(a.id)}
                            onChange={() => toggleAssignmentCompleted(a.id)}
                            className="accent-sky-600"
                          />
                          {a.title}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleCheckinSubmit}
                    disabled={checkinSaving}
                    className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                  >
                    {checkinSaving ? "Saving…" : "Submit check-in"}
                  </button>
                  <button
                    onClick={() => { setShowCheckinForm(false); setUpdateForm(EMPTY_UPDATE_FORM); setCompletedAssignIds([]); }}
                    className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* History */}
            {weeklyUpdates.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">History</p>
                {weeklyUpdates.map((w) => (
                  <div key={w.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">Week {w.week}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Confidence</span>
                        <span className="text-xs font-bold text-sky-700">{w.confidenceLevel}/5</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          w.menteeAttendance === "Present"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : w.menteeAttendance === "Excused"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}>{w.menteeAttendance}</span>
                      </div>
                    </div>
                    {w.wins && <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Wins:</span> {w.wins}</p>}
                    {w.blockers && <p className="mt-1 text-sm text-slate-600"><span className="font-semibold">Blockers:</span> {w.blockers}</p>}
                    {w.nextWeekFocus && <p className="mt-1 text-xs text-slate-500">Next focus: {w.nextWeekFocus}</p>}
                  </div>
                ))}
              </div>
            )}

            {weeklyUpdates.length === 0 && !showCheckinForm && (
              <p className="mt-6 text-sm text-slate-500">No check-ins submitted yet. Click &ldquo;Submit check-in&rdquo; to get started.</p>
            )}
          </section>
        )}

        {/* Feedback tab */}
        {activeTab === "feedback" && (
          <section className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mentor support</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Your mentor: {mentor?.name ?? "Not assigned yet"}
            </h2>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-semibold text-slate-900">Latest feedback</h3>
                {latestFeedback ? (
                  <div className="mt-4 space-y-3">
                    {SCORE_LABELS.map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700">{label}</span>
                          <span className="font-semibold text-slate-900">{latestFeedback[key]}/5</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200">
                          <div
                            className="h-1.5 rounded-full bg-amber-500 transition-all"
                            style={{ width: `${(latestFeedback[key] / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {latestFeedback.notes && (
                      <p className="mt-3 text-sm text-slate-600 italic">&ldquo;{latestFeedback.notes}&rdquo;</p>
                    )}
                    {latestFeedback.strengths.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-[0.14em]">Strengths</p>
                        <p className="mt-1 text-sm text-slate-700">{latestFeedback.strengths.join(", ")}</p>
                      </div>
                    )}
                    {latestFeedback.areasForImprovement.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-[0.14em]">Areas to improve</p>
                        <p className="mt-1 text-sm text-slate-700">{latestFeedback.areasForImprovement.join(", ")}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">No feedback submitted yet.</p>
                )}
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
                <h3 className="text-sm font-semibold text-sky-900">Track: {mentee.track}</h3>
                <div className="mt-4 text-xs text-sky-700">
                  <p>Come prepared to your next connect with:</p>
                  <ul className="mt-2 ml-4 list-disc space-y-1">
                    <li>One blocker you&apos;re facing</li>
                    <li>One win or progress moment</li>
                    <li>Questions for your mentor</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
