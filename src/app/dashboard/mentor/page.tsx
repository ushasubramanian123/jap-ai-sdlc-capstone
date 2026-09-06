"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useMockStore } from "@/lib/mock-store";
import {
  getMentorByEmail,
  getMenteesByMentorId,
  getAllMentees,
  getAllAssignments,
  getSubmissionsForMentor,
  getMentorFeedbackForMentee,
  updateSubmissionStatus,
  saveMentorFeedback,
} from "@/lib/firestore-helpers";
import type { Mentee, Assignment, Submission, MentorFeedback } from "@/lib/firestore-schema";

function mentorStatusBadgeClass(status: Submission["mentorStatus"]) {
  const map: Record<Submission["mentorStatus"], string> = {
    PENDING: "border-sky-200 bg-sky-50 text-sky-700",
    EVALUATED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REWORK_REQUESTED: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return `text-xs font-semibold px-3 py-1 rounded-full border ${map[status]}`;
}

function riskBadgeClass(level: Mentee["riskLevel"]) {
  const map: Record<Mentee["riskLevel"], string> = {
    High: "border-rose-200 bg-rose-50 text-rose-700",
    Medium: "border-amber-200 bg-amber-50 text-amber-700",
    Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return `rounded-full border px-3 py-1 text-xs font-semibold ${map[level]}`;
}

const SCORE_LABELS = [
  { key: "technicalPerformance" as const, label: "Technical Performance" },
  { key: "communicationSkills" as const, label: "Communication Skills" },
  { key: "projectEngagement" as const, label: "Project Engagement" },
  { key: "independenceLevel" as const, label: "Independence Level" },
];

const EMPTY_FEEDBACK_FORM = {
  technicalPerformance: 3,
  communicationSkills: 3,
  projectEngagement: 3,
  independenceLevel: 3,
  notes: "",
  strengths: "",
  areasForImprovement: "",
};

export default function MentorDashboard() {
  const { user, firebaseConfigured } = useAuth();
  const mockStore = useMockStore();

  const [mentorId, setMentorId] = useState<string>("mentor-001");
  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [fsAssignments, setFsAssignments] = useState<Assignment[]>([]);
  const [fsSubmissions, setFsSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const menteeIds = mentees.map((m) => m.id);
  const assignments = firebaseConfigured ? fsAssignments : mockStore.assignments;
  const submissions = firebaseConfigured
    ? fsSubmissions
    : mockStore.submissions.filter((s) => menteeIds.includes(s.menteeId));

  const [activeTab, setActiveTab] = useState<"submissions" | "mentees" | "feedback">("submissions");

  // Alert banner dismiss (session-scoped)
  const [alertDismissed, setAlertDismissed] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem("jap-risk-alerts-dismissed") === "1") setAlertDismissed(true);
  }, []);

  function handleDismissAlerts() {
    sessionStorage.setItem("jap-risk-alerts-dismissed", "1");
    setAlertDismissed(true);
  }

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const alertItems = useMemo(() => {
    const items: { key: string; text: string }[] = [];
    const now = Date.now();
    for (const m of mentees) {
      if (m.riskLevel === "High")
        items.push({ key: `risk-${m.id}`, text: `${m.name} — High risk` });
      if (m.confidenceScore <= 2)
        items.push({ key: `conf-${m.id}`, text: `${m.name} — Confidence ${m.confidenceScore}/5` });
    }
    for (const sub of submissions) {
      if (sub.mentorStatus === "PENDING" && now - sub.submittedAt > THREE_DAYS_MS) {
        const mentee = mentees.find((m) => m.id === sub.menteeId);
        const assignment = assignments.find((a) => a.id === sub.assignmentId);
        const days = Math.floor((now - sub.submittedAt) / 86_400_000);
        items.push({
          key: `overdue-${sub.id}`,
          text: `${mentee?.name ?? "Mentee"} — "${assignment?.title ?? "Submission"}" pending for ${days}d`,
        });
      }
    }
    return items;
  }, [mentees, submissions, assignments]); // eslint-disable-line react-hooks/exhaustive-deps

  // Submission review state
  const [reworkId, setReworkId] = useState<string | null>(null);
  const [reworkNote, setReworkNote] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Feedback state
  const [feedbackMap, setFeedbackMap] = useState<Record<string, MentorFeedback[]>>({});
  const [feedbackOpenId, setFeedbackOpenId] = useState<string | null>(null);
  const [feedbackForm, setFeedbackForm] = useState(EMPTY_FEEDBACK_FORM);
  const [feedbackWeek, setFeedbackWeek] = useState(1);
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    async function load() {
      try {
        const mentor = await getMentorByEmail(user!.email!);
        const resolvedMentorId = mentor?.id ?? "mentor-001";
        setMentorId(resolvedMentorId);

        let myMentees: Mentee[] = [];
        if (mentor) {
          myMentees = await getMenteesByMentorId(mentor.id);
        } else {
          myMentees = await getAllMentees();
        }
        setMentees(myMentees);

        // Load feedback for each mentee
        const fbEntries = await Promise.all(
          myMentees.map(async (m) => {
            const fb = firebaseConfigured
              ? await getMentorFeedbackForMentee(m.id)
              : mockStore.feedback.filter((f) => f.menteeId === m.id);
            return [m.id, fb] as [string, MentorFeedback[]];
          })
        );
        setFeedbackMap(Object.fromEntries(fbEntries));

        if (firebaseConfigured) {
          const [a, s] = await Promise.all([
            getAllAssignments(),
            getSubmissionsForMentor(myMentees.map((m) => m.id)),
          ]);
          setFsAssignments(a);
          setFsSubmissions(s);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, firebaseConfigured]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEvaluate(submissionId: string) {
    setActionLoading(submissionId);
    try {
      if (!firebaseConfigured) {
        mockStore.patchSubmission(submissionId, { mentorStatus: "EVALUATED", evaluatedAt: Date.now() });
      } else {
        await updateSubmissionStatus(submissionId, "EVALUATED");
        setFsSubmissions((prev) =>
          prev.map((s) =>
            s.id === submissionId ? { ...s, mentorStatus: "EVALUATED", evaluatedAt: Date.now() } : s
          )
        );
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRework(submissionId: string) {
    if (!reworkNote.trim()) return;
    setActionLoading(submissionId);
    try {
      if (!firebaseConfigured) {
        mockStore.patchSubmission(submissionId, {
          mentorStatus: "REWORK_REQUESTED",
          mentorNote: reworkNote.trim(),
        });
      } else {
        await updateSubmissionStatus(submissionId, "REWORK_REQUESTED", reworkNote.trim());
        setFsSubmissions((prev) =>
          prev.map((s) =>
            s.id === submissionId
              ? { ...s, mentorStatus: "REWORK_REQUESTED", mentorNote: reworkNote.trim() }
              : s
          )
        );
      }
      setReworkId(null);
      setReworkNote("");
    } finally {
      setActionLoading(null);
    }
  }

  function openFeedbackForm(menteeId: string) {
    const existing = feedbackMap[menteeId] ?? [];
    const latest = existing.sort((a, b) => b.week - a.week)[0];
    setFeedbackForm(
      latest
        ? {
            technicalPerformance: latest.technicalPerformance,
            communicationSkills: latest.communicationSkills,
            projectEngagement: latest.projectEngagement,
            independenceLevel: latest.independenceLevel,
            notes: latest.notes,
            strengths: latest.strengths.join(", "),
            areasForImprovement: latest.areasForImprovement.join(", "),
          }
        : EMPTY_FEEDBACK_FORM
    );
    const mentee = mentees.find((m) => m.id === menteeId);
    setFeedbackWeek(mentee?.weeksEnrolled ?? 1);
    setFeedbackOpenId(menteeId);
  }

  async function handleFeedbackSave(menteeId: string) {
    setFeedbackSaving(true);
    const now = Date.now();
    const data: Omit<MentorFeedback, "id"> = {
      menteeId,
      mentorId,
      week: feedbackWeek,
      technicalPerformance: feedbackForm.technicalPerformance,
      communicationSkills: feedbackForm.communicationSkills,
      projectEngagement: feedbackForm.projectEngagement,
      independenceLevel: feedbackForm.independenceLevel,
      notes: feedbackForm.notes,
      strengths: feedbackForm.strengths.split(",").map((s) => s.trim()).filter(Boolean),
      areasForImprovement: feedbackForm.areasForImprovement.split(",").map((s) => s.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now,
    };
    try {
      if (!firebaseConfigured) {
        const saved = mockStore.feedback.find(
          (f) => f.menteeId === menteeId && f.week === feedbackWeek
        );
        if (saved) {
          mockStore.patchFeedback(saved.id, data);
          setFeedbackMap((prev) => ({
            ...prev,
            [menteeId]: (prev[menteeId] ?? []).map((f) =>
              f.id === saved.id ? { ...f, ...data } : f
            ),
          }));
        } else {
          mockStore.addFeedback({ id: `fb-${Date.now()}`, ...data });
          setFeedbackMap((prev) => ({
            ...prev,
            [menteeId]: [...(prev[menteeId] ?? []), { id: `fb-${Date.now()}`, ...data }],
          }));
        }
      } else {
        const saved = await saveMentorFeedback(data);
        setFeedbackMap((prev) => ({
          ...prev,
          [menteeId]: [...(prev[menteeId] ?? []).filter((f) => f.week !== feedbackWeek), saved],
        }));
      }
      setFeedbackOpenId(null);
    } finally {
      setFeedbackSaving(false);
    }
  }

  const avgConfidence =
    mentees.length > 0
      ? (mentees.reduce((sum, m) => sum + m.confidenceScore, 0) / mentees.length).toFixed(1)
      : "—";

  const pendingCount = submissions.filter((s) => s.mentorStatus === "PENDING").length;

  const metrics = [
    { title: "Assigned mentees", value: mentees.length, note: "Across training and billable tracks" },
    { title: "Pending reviews", value: pendingCount, note: "Submissions awaiting evaluation" },
    { title: "Avg. confidence", value: `${avgConfidence}/5`, note: "Based on current assessments" },
    { title: "Total submissions", value: submissions.length, note: "Across all assignments" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fff9eb_0%,#f4f7fb_42%,#eef3f8_100%)] flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff9eb_0%,#f4f7fb_42%,#eef3f8_100%)] text-slate-950">
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 space-y-6">

        {/* Header */}
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">Mentor Dashboard</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Coach mentees through assignments and confidence building
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Prioritize buddy connects, feedback loops, and red-flag detection for your assigned mentees.
          </p>
        </section>

        {/* Proactive Risk Alerts */}
        {!alertDismissed && alertItems.length > 0 && (
          <section
            role="alert"
            className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 shadow-[0_8px_32px_rgba(225,29,72,0.10)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-rose-800">
                    {alertItems.length} mentee{alertItems.length !== 1 ? "s" : ""} need{alertItems.length === 1 ? "s" : ""} your attention
                  </p>
                  <ul className="mt-2 space-y-1">
                    {alertItems.map((item) => (
                      <li key={item.key} className="text-sm text-rose-700">
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <button
                onClick={handleDismissAlerts}
                aria-label="Dismiss alerts"
                className="shrink-0 rounded-xl border border-rose-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-white transition"
              >
                Dismiss
              </button>
            </div>
          </section>
        )}

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
        <div className="flex gap-2">
          {([
            ["submissions", `Submissions (${submissions.length})`],
            ["mentees", `Mentees (${mentees.length})`],
            ["feedback", "Submit Feedback"],
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

        {/* Submissions tab */}
        {activeTab === "submissions" && (
          <section className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Submissions</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Review mentee submissions ({submissions.length})
            </h2>

            {submissions.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">No submissions yet from your mentees.</p>
            ) : (
              <div className="mt-6 space-y-4">
                {submissions.map((sub) => {
                  const mentee = mentees.find((m) => m.id === sub.menteeId);
                  const assignment = assignments.find((a) => a.id === sub.assignmentId);
                  return (
                    <div key={sub.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {assignment?.title ?? sub.assignmentId}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {mentee?.name ?? sub.menteeId} · v{sub.version} ·{" "}
                            {new Date(sub.submittedAt).toLocaleDateString()}
                          </p>
                          {sub.fileUrls.length > 0 && (
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
                        <span className={mentorStatusBadgeClass(sub.mentorStatus)}>
                          {sub.mentorStatus.replace(/_/g, " ")}
                        </span>
                      </div>

                      {sub.mentorNote && sub.mentorStatus !== "REWORK_REQUESTED" && (
                        <p className="mt-3 text-xs text-slate-500">Note: {sub.mentorNote}</p>
                      )}

                      {sub.mentorStatus === "PENDING" && (
                        <div className="mt-4 flex flex-wrap gap-3 items-start">
                          <button
                            onClick={() => handleEvaluate(sub.id)}
                            disabled={actionLoading === sub.id}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                          >
                            {actionLoading === sub.id ? "Saving…" : "Mark evaluated"}
                          </button>
                          <button
                            onClick={() => {
                              setReworkId(reworkId === sub.id ? null : sub.id);
                              setReworkNote("");
                            }}
                            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
                          >
                            Request rework
                          </button>
                        </div>
                      )}

                      {reworkId === sub.id && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            rows={2}
                            placeholder="What needs to be reworked?"
                            value={reworkNote}
                            onChange={(e) => setReworkNote(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRework(sub.id)}
                              disabled={!reworkNote.trim() || actionLoading === sub.id}
                              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition"
                            >
                              {actionLoading === sub.id ? "Sending…" : "Send back"}
                            </button>
                            <button
                              onClick={() => setReworkId(null)}
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

        {/* Mentees tab */}
        {activeTab === "mentees" && (
          <section className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Your mentees</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Progress tracking</h2>
            {mentees.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">No mentees assigned yet.</p>
            ) : (
              <div className="mt-6 space-y-4">
                {mentees.map((mentee) => {
                  const latestFb = (feedbackMap[mentee.id] ?? []).sort((a, b) => b.week - a.week)[0];
                  return (
                    <div key={mentee.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{mentee.name}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {mentee.track} track · Week {mentee.weeksEnrolled}
                          </p>
                        </div>
                        <span className={riskBadgeClass(mentee.riskLevel)}>{mentee.riskLevel} risk</span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Completion</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{mentee.completionPercentage}%</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Confidence</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{mentee.confidenceScore}/5</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Submissions</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {submissions.filter((s) => s.menteeId === mentee.id).length}
                          </p>
                        </div>
                      </div>
                      {latestFb && (
                        <div className="mt-4 border-t border-slate-200 pt-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">
                            Latest feedback — Week {latestFb.week}
                          </p>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                            {SCORE_LABELS.map(({ key, label }) => (
                              <div key={key}>
                                <p className="text-xs text-slate-500">{label}</p>
                                <p className="text-sm font-semibold text-slate-900">{latestFb[key]}/5</p>
                              </div>
                            ))}
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

        {/* Feedback tab */}
        {activeTab === "feedback" && (
          <section className="rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mentor Feedback</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Submit feedback for your mentees</h2>
            <p className="mt-1 text-sm text-slate-500">Rate each mentee on 4 dimensions and add qualitative notes.</p>

            <div className="mt-6 space-y-4">
              {mentees.map((mentee) => {
                const isOpen = feedbackOpenId === mentee.id;
                const allFb = (feedbackMap[mentee.id] ?? []).sort((a, b) => b.week - a.week);
                const latestFb = allFb[0];
                return (
                  <div key={mentee.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{mentee.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Week {mentee.weeksEnrolled} · {mentee.track}
                          {latestFb ? ` · Last feedback: Week ${latestFb.week}` : " · No feedback yet"}
                        </p>
                      </div>
                      {!isOpen && (
                        <button
                          onClick={() => openFeedbackForm(mentee.id)}
                          className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                        >
                          {latestFb ? "Update feedback" : "Submit feedback"}
                        </button>
                      )}
                    </div>

                    {isOpen && (
                      <div className="mt-5 space-y-4">
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 whitespace-nowrap">
                            Week #
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={feedbackWeek}
                            onChange={(e) => setFeedbackWeek(Number(e.target.value))}
                            className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                          />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          {SCORE_LABELS.map(({ key, label }) => (
                            <div key={key} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-700">{label}</label>
                                <span className="text-xs font-bold text-amber-700">
                                  {feedbackForm[key]}/5
                                </span>
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={5}
                                step={1}
                                value={feedbackForm[key]}
                                onChange={(e) =>
                                  setFeedbackForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                                }
                                className="w-full accent-amber-600"
                              />
                              <div className="flex justify-between text-xs text-slate-400">
                                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <textarea
                          placeholder="Notes (overall observations)"
                          rows={2}
                          value={feedbackForm.notes}
                          onChange={(e) => setFeedbackForm((f) => ({ ...f, notes: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none transition"
                        />
                        <input
                          type="text"
                          placeholder="Strengths (comma-separated)"
                          value={feedbackForm.strengths}
                          onChange={(e) => setFeedbackForm((f) => ({ ...f, strengths: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
                        />
                        <input
                          type="text"
                          placeholder="Areas for improvement (comma-separated)"
                          value={feedbackForm.areasForImprovement}
                          onChange={(e) =>
                            setFeedbackForm((f) => ({ ...f, areasForImprovement: e.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
                        />

                        <div className="flex gap-3">
                          <button
                            onClick={() => handleFeedbackSave(mentee.id)}
                            disabled={feedbackSaving}
                            className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                          >
                            {feedbackSaving ? "Saving…" : "Save feedback"}
                          </button>
                          <button
                            onClick={() => setFeedbackOpenId(null)}
                            className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {!isOpen && allFb.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                        {SCORE_LABELS.map(({ key, label }) => (
                          <div key={key}>
                            <p className="text-xs text-slate-500">{label}</p>
                            <p className="text-sm font-semibold text-slate-900">{latestFb![key]}/5</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
