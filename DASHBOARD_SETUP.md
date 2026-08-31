# JAP Dashboard — Setup & Usage Guide

## Overview

The **Junior Adoption Program (JAP) Dashboard** is a role-based Next.js 16 application built with React 19, Tailwind CSS, and Firebase. It provides three distinct views for **admins**, **mentors**, and **mentees**, each with tailored metrics, workflows, and data.

## Current Architecture

### Tech Stack
- **Framework:** Next.js 16.2.4 (App Router with Turbopack)
- **UI:** React 19 + Tailwind CSS 4
- **Backend:** Firebase Authentication + Firestore Database
- **Language:** TypeScript 5

### File Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page (role selector)
│   ├── layout.tsx                  # Root layout with AuthProvider
│   ├── globals.css                 # Global styling
│   └── dashboard/
│       ├── admin/page.tsx          # Admin dashboard
│       ├── mentor/page.tsx         # Mentor dashboard
│       └── mentee/page.tsx         # Mentee dashboard
├── lib/
│   ├── firebase.ts                 # Firebase SDK initialization
│   ├── auth-context.tsx            # React Context for authentication
│   ├── dashboard-data.ts           # Sample data and program config
│   ├── firestore-schema.ts         # Firestore type definitions
│   └── firestore-helpers.ts        # Queries and CRUD operations
└── public/                         # Static assets
```

## Running Locally

### Prerequisites
- Node.js 18+ (with npm)
- Firebase project (optional, can run in mock mode without it)

### Commands

**Start development server:**
```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

**Run linter:**
```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run lint
```

**Build for production:**
```powershell
npm run build
npm start
```

The app will be available at **http://localhost:3000**

## Features by Role

### Admin Dashboard (`/dashboard/admin`)
- Cohort completion percentage and high-risk mentee count
- Mentor utilization metrics
- Enrollment overview (mentees and mentors list)
- Risk watchlist with mitigation strategies
- Weekly workshop schedule
- Focus items and quick actions

### Mentor Dashboard (`/dashboard/mentor`)
- Assigned mentees list with confidence and completion scores
- Assignment review queue (pending A1 drafts)
- Weekly mentor priorities and task list
- Current phase assignment guidance
- Mentee progress tracking
- Quick action prompts

### Mentee Dashboard (`/dashboard/mentee`)
- Personal progress (week, completion %, confidence score)
- Next mentor connect scheduling
- All 9 assignments with completion status
- Mentor feedback scores by dimension
- Weekly focus items and blockers
- Quick action prompts

## Firebase Setup (Optional)

### To Enable Live Data:

1. **Create a Firebase project:**  
   Go to [firebase.google.com](https://firebase.google.com) and create a new project.

2. **Copy your project config:**  
   In Firebase Console → Project Settings, copy the config values.

3. **Create `.env.local` in the project root:**
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Enable Authentication:**
   - Go to Firebase Console → Authentication
   - Enable **Email/Password** as a sign-in method
   - Create test users for each role

5. **Create Firestore Collections:**  
   The app expects these collections:
   - `mentees` — Mentee profiles and progress
   - `mentors` — Mentor profiles
   - `assignments` — 9 program assignments
   - `weekly_updates` — Weekly mentor-mentee connect notes
   - `mentor_feedback` — Structured feedback on mentees

6. **Seed Sample Data:**  
   Use the mock data in [`src/lib/firestore-helpers.ts`](../src/lib/firestore-helpers.ts) as a template:
   ```typescript
   export const mockMentees: Mentee[] = [...]
   ```

### Running Without Firebase:
The app gracefully falls back to mock data if Firebase keys are missing. Mock data is pre-loaded from `firestore-helpers.ts`, allowing you to test UI and flows without a backend.

## Authentication Flow

- **AuthProvider** (in `src/lib/auth-context.tsx`) wraps the entire app
- Provides `useAuth()` hook for role-based access
- Falls back to mock user (`Demo User`) when Firebase is unconfigured
- Stores user role and email in context for role-based dashboard routing

## Sample Data

Default sample mentees and mentors are in `firestore-helpers.ts`:
- **Ananya R.** (Training track, Medium risk)
- **Sai K.** (Billable track, Low risk)
- **Harini V.** (Training track, High risk)

These are used in development and as fallback when Firestore is unavailable.

## Deployment (Vercel)

1. **Connect GitHub repo to Vercel**
2. **Set environment variables** in Vercel project settings (copy from `.env.local`)
3. **Deploy** — Vercel will automatically detect Next.js and build optimally

## Next Steps

- [ ] Integrate Firestore live queries for real mentee/mentor data
- [ ] Add Firebase Authentication UI (login/signup pages)
- [ ] Implement assignment submission and feedback forms
- [ ] Add weekly updates modal and DM feedback collection
- [ ] Create reporting dashboard for cohort stats over time
- [ ] Add role-based access control (RBAC) middleware
- [ ] Implement real-time notifications for mentee/mentor updates
- [ ] Add email notifications for assignment deadlines

## Troubleshooting

**"localhost refused to connect"**
- Ensure the dev server is running: `npm run dev`
- Check that port 3000 is not in use

**"Firebase config missing" warning**
- App is running in mock mode; this is normal during development
- To enable live data, populate `.env.local` with Firebase keys

**Browser cache stale errors**
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Clear browser cache if issues persist

## Questions or Issues?

Refer to the [JAP Comprehensive Program Plan](../../OneDrive%20-%20EPAM/JAP_Comprehensive_Program_Plan.md) for program details, curriculum, and mentor/mentee roles.
