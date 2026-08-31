export type Role = "admin" | "mentor" | "mentee";

export type Metric = {
  title: string;
  value: string;
  note: string;
};

export type CohortMember = {
  name: string;
  track: "Training" | "Billable";
  mentor: string;
  week: number;
  completion: number;
  confidence: number;
  nextAction: string;
  risk: "Low" | "Medium" | "High";
};

type RoleView = {
  label: string;
  headline: string;
  summary: string;
  metrics: Metric[];
  focusItems: string[];
  quickActions: string[];
};

export const programHighlights = {
  duration: "8 weeks",
  cohortSize: "46 mentees",
  mentors: "18 mentors",
  launchWindow: "Pilot in May 2026",
  targetBillability: "80% in 3 months",
};

export const weeklyTimeline = [
  {
    week: "Week 1",
    title: "Preparation",
    detail: "BU head kickoff, mentor identification, and gap assessment survey.",
  },
  {
    week: "Week 2",
    title: "Matching and planning",
    detail: "Survey analysis, mentor matching, IDPs, onboarding, and setup.",
  },
  {
    week: "Week 3",
    title: "Launch",
    detail: "Kickoff session, first buddy connect, and Assignment 1 status email.",
  },
  {
    week: "Week 4",
    title: "Foundation building",
    detail: "HR orientation, standup simulation, and Assignment 2 delivery.",
  },
  {
    week: "Week 5",
    title: "Communication skills",
    detail: "Leadership exposure with presentation and client interaction practice.",
  },
  {
    week: "Week 6",
    title: "Mid-program review",
    detail: "DM feedback, assignment reviews, and support plan adjustments.",
  },
  {
    week: "Week 7",
    title: "Collaboration and feedback",
    detail: "Peer workshop, feedback practice, and meeting summary follow-up.",
  },
  {
    week: "Week 8",
    title: "Completion",
    detail: "Blocker escalation exercise, final assessment, and cohort celebration.",
  },
];

export const assignments = [
  {
    id: "A1",
    title: "Status Update Email",
    week: "Week 3",
    area: "Basic Communication",
    mentorView: "Review clarity and tone",
    menteeView: "Draft weekly update with blockers and next steps",
    adminView: "Track completion rate and quality feedback",
    status: "Active",
  },
  {
    id: "A2",
    title: "2-Minute Standup",
    week: "Week 4",
    area: "Basic Communication",
    mentorView: "Challenge blockers and follow-up questions",
    menteeView: "Record concise update with confidence",
    adminView: "Confirm workshop participation",
    status: "Queued",
  },
  {
    id: "A3-A4",
    title: "Presentation and Client Scenario",
    week: "Week 5",
    area: "Basic Communication",
    mentorView: "Run mock Q&A and presentation feedback",
    menteeView: "Present topic and answer client-style questions",
    adminView: "Monitor leadership session attendance",
    status: "Planned",
  },
  {
    id: "A5-A7",
    title: "Collaboration and Planning",
    week: "Weeks 6-7",
    area: "Collaboration & Task Management",
    mentorView: "Coach teamwork, estimates, and peer feedback",
    menteeView: "Pair, plan, and provide constructive feedback",
    adminView: "Watch for delays and mentor load imbalance",
    status: "Planned",
  },
  {
    id: "A8-A9",
    title: "Follow-up and Escalation",
    week: "Weeks 7-8",
    area: "Critical Client Interaction",
    mentorView: "Assess professionalism under pressure",
    menteeView: "Summarize meetings and escalate blockers without blame",
    adminView: "Review final readiness and risk outcomes",
    status: "Planned",
  },
];

export const cohortMembers: CohortMember[] = [
  {
    name: "Ananya R.",
    track: "Training",
    mentor: "Rakesh P.",
    week: 3,
    completion: 22,
    confidence: 3,
    nextAction: "Submit Assignment 1 draft",
    risk: "Medium",
  },
  {
    name: "Sai K.",
    track: "Billable",
    mentor: "Madhavi S.",
    week: 5,
    completion: 46,
    confidence: 4,
    nextAction: "Prepare 5-minute presentation",
    risk: "Low",
  },
  {
    name: "Harini V.",
    track: "Training",
    mentor: "Rakesh P.",
    week: 4,
    completion: 31,
    confidence: 2,
    nextAction: "Attend standup simulation",
    risk: "High",
  },
  {
    name: "Vikram N.",
    track: "Billable",
    mentor: "Kiran T.",
    week: 6,
    completion: 58,
    confidence: 4,
    nextAction: "Review weekly task plan with lead",
    risk: "Low",
  },
  {
    name: "Deepa M.",
    track: "Training",
    mentor: "Madhavi S.",
    week: 7,
    completion: 72,
    confidence: 5,
    nextAction: "Draft meeting follow-up email",
    risk: "Low",
  },
];

export const riskBoard = [
  {
    title: "Low mentee engagement",
    impact: "High",
    mitigation: "Manager alignment and weekly check-ins for inactive mentees.",
  },
  {
    title: "Mentor availability",
    impact: "High",
    mitigation: "Maintain backup mentors and watch weekly workload spread.",
  },
  {
    title: "Assignment delays",
    impact: "Medium",
    mitigation: "Flag missed deadlines by Friday and trigger champion support.",
  },
];

export const workshops = [
  {
    title: "Effective Communication Fundamentals",
    timing: "Week 4",
    format: "Interactive workshop",
  },
  {
    title: "Confidence Building and Imposter Syndrome",
    timing: "Week 6",
    format: "Facilitated discussion",
  },
  {
    title: "Collaboration and Teamwork",
    timing: "Week 7",
    format: "Group simulations",
  },
];

export const roleViews: Record<Role, RoleView> = {
  admin: {
    label: "Admin view",
    headline: "Program health across cohort, mentors, and outcomes",
    summary:
      "Track cohort completion, risks, and mentor utilization while preparing weekly BU and HR reporting.",
    metrics: [
      { title: "Cohort completion", value: "54%", note: "Across current 46 mentees" },
      { title: "High-risk mentees", value: "4", note: "Need champion intervention" },
      { title: "Mentor utilization", value: "83%", note: "Within the target workload band" },
      { title: "Survey completion", value: "91%", note: "Pre and mid-program responses" },
    ],
    focusItems: [
      "Review weekly mentor updates every Friday EOD.",
      "Escalate delays for assignments A1 and A2 within 24 hours.",
      "Prepare BU-head summary with billability and confidence trends.",
    ],
    quickActions: [
      "Publish weekly dashboard snapshot",
      "Schedule mentor office hours",
      "Collect monthly DM feedback",
    ],
  },
  mentor: {
    label: "Mentor view",
    headline: "Coach mentees through assignments, confidence gaps, and project readiness",
    summary:
      "Prioritize buddy connects, feedback loops, and red-flag detection for your assigned mentees.",
    metrics: [
      { title: "Assigned mentees", value: "5", note: "Across training and billable tracks" },
      { title: "Pending reviews", value: "3", note: "A1 drafts and standup recordings" },
      { title: "Connects completed", value: "7/8", note: "This week versus plan" },
      { title: "Confidence average", value: "3.6/5", note: "Improving after role-play practice" },
    ],
    focusItems: [
      "Run one-on-ones with struggling mentees first.",
      "Give written feedback within 48 hours for submitted assignments.",
      "Escalate blockers early when project exposure is missing.",
    ],
    quickActions: [
      "Review Assignment 1 drafts",
      "Book mock client scenario",
      "Submit weekly mentor update",
    ],
  },
  mentee: {
    label: "Mentee view",
    headline: "See your next assignments, readiness progress, and mentor support",
    summary:
      "Use the dashboard to stay on top of assignments, workshops, and feedback from your mentor.",
    metrics: [
      { title: "Current week", value: "Week 5", note: "Communication skills phase" },
      { title: "Assignments done", value: "2/9", note: "Basic communication in progress" },
      { title: "Confidence score", value: "3.8/5", note: "From latest self-assessment" },
      { title: "Next mentor connect", value: "Tomorrow", note: "3:30 PM with Rakesh P." },
    ],
    focusItems: [
      "Finish your presentation outline before the mock client review.",
      "Bring one blocker and one win to the next buddy connect.",
      "Complete workshop reflection by Friday EOD.",
    ],
    quickActions: [
      "Open assignment brief",
      "Check mentor feedback",
      "Update self-assessment",
    ],
  },
};