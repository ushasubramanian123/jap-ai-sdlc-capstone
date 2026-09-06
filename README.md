# JAP Dashboard — Junior Adoption Program

A Next.js 16 App Router application with Firebase backend for managing the Junior Adoption Program (JAP). Mentors, mentees, and admins each have role-scoped dashboards.

## Features

### Proactive Risk Alerts (Mentor Dashboard)

The mentor dashboard shows a dismissable alert banner above the stats cards whenever a mentee needs attention, so mentors see risk on page load without drilling into records.

An alert is raised when:

| Signal | Threshold | Alert text |
| --- | --- | --- |
| Mentee risk level | `riskLevel = High` | `<Name> — High risk` |
| Mentee confidence | `confidenceScore <= 2` (inclusive at 2) | `<Name> — Confidence X/5` |
| Stale submission | `PENDING` for **more than** 3 days (exactly 3 days does not alert) | `<Name> — '<Assignment>' pending for Xd` |

Behaviour notes:
- A single mentee can raise multiple alert items (e.g. High risk *and* low confidence).
- If no condition is met, the banner is not rendered at all.
- **Dismiss** hides the banner for the rest of the browser session via `sessionStorage` (key `jap-risk-alerts-dismissed`). A new tab or new browser session shows it again.
- The banner uses `role="alert"` so screen readers announce it when it appears.
- Alerts are computed client-side with `useMemo` — no extra network requests.

Implementation: `src/app/dashboard/mentor/page.tsx` · JIRA: EPMCDMETST-63047

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
