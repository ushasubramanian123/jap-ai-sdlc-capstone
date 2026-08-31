# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint (flat config via eslint.config.mjs)
```

No test runner is configured.

## Architecture

**JAP Dashboard** (Junior Adoption Program) — a Next.js 16 App Router app with Firebase backend, TypeScript strict mode, and Tailwind CSS v4.

### Directory structure

```
src/
├── app/
│   ├── layout.tsx               # Root layout; wraps everything in <AuthProvider>
│   ├── page.tsx                 # Landing page with role selector (client component)
│   └── dashboard/
│       ├── admin/page.tsx       # Server component — awaits firestore-helpers directly
│       ├── mentor/page.tsx      # Client component — useEffect data loading
│       └── mentee/page.tsx      # Client component — currently hardcoded mock data
└── lib/
    ├── firebase.ts              # Firebase SDK init; exports nullable auth/db/storage
    ├── auth-context.tsx         # AuthContext + useAuth() hook; mock fallback when no Firebase config
    ├── dashboard-data.ts        # Static mock data: highlights, timeline, assignments, cohort
    ├── firestore-schema.ts      # TypeScript types + COLLECTIONS map for all 7 collections
    └── firestore-helpers.ts     # Async CRUD functions; fall back to mock data when db is null
```

### Data flow and Firebase fallback

`firebase.ts` checks `NEXT_PUBLIC_FIREBASE_*` env vars. If absent, `db`/`auth` are null. All functions in `firestore-helpers.ts` guard with `if (!db)` and return mock data, so the app runs without Firebase credentials. `auth-context.tsx` similarly falls back to a hardcoded `MOCK_USER` (`demo@epam.com`, role `"admin"`).

### Server vs. Client components

- `admin/page.tsx` is a Server Component — calls `await getCohortStats()` / `await getAllMentees()` at render time.
- `mentor/` and `mentee/` pages are Client Components (`"use client"`), using `useAuth()` and `useEffect`.

### Domain model (`firestore-schema.ts`)

Seven Firestore collections: `mentees`, `mentors`, `assignments`, `mentee_assignment_progress`, `weekly_updates`, `mentor_feedback`, `users`. Key types: `Mentee` (riskLevel, confidenceScore), `Mentor` (level A2/A3/A4, menteeIds), `Assignment` (status Planned/Queued/Active/Completed), `User` (role admin/mentor/mentee).

### Known gaps

- Role is not fetched from Firestore — `auth-context.tsx` has a `// TODO: Fetch user role` and defaults to `"mentee"` when Firebase is live.
- No RBAC middleware — any user can visit any `/dashboard/*` route.
- `mentee/page.tsx` is fully hardcoded; it does not read from auth context or Firestore.
- Path alias `@/*` → `./src/*`.
- Tailwind v4 uses the CSS-first API (`@import "tailwindcss"` in `globals.css`) — no `tailwind.config.js`.
