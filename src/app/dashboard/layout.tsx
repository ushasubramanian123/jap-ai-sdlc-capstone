"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/auth-context";

const ROLE_DASHBOARD: Record<string, string> = {
  champion: "/dashboard/champion",
  mentor: "/dashboard/mentor",
  mentee: "/dashboard/mentee",
};

const MOCK_ROLE_USERS: Record<string, { email: string; name: string }> = {
  champion: { email: "champion@epam.com", name: "Demo Champion" },
  mentor: { email: "rakesh.p@epam.com", name: "Rakesh P." },
  mentee: { email: "ananya.r@epam.com", name: "Ananya R." },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading, firebaseConfigured, logout, switchMockRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (firebaseConfigured && !user) { router.push("/login"); return; }
    if (!firebaseConfigured) return;
    if (!role) return;
    const allowed = ROLE_DASHBOARD[role];
    if (allowed && !pathname.startsWith(allowed)) router.push(allowed);
  }, [loading, firebaseConfigured, user, role, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fff9eb_0%,#f4f7fb_42%,#eef3f8_100%)] flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (firebaseConfigured && !user) return null;
  if (firebaseConfigured && role && !pathname.startsWith(ROLE_DASHBOARD[role] ?? "")) return null;

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  function handleRoleSwitch(newRole: UserRole) {
    switchMockRole(newRole);
    router.push(ROLE_DASHBOARD[newRole ?? ""] ?? "/dashboard/champion");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">JAP</span>
            {role && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-0.5 text-xs font-semibold capitalize text-slate-600">
                {role}
              </span>
            )}
            {!firebaseConfigured && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                mock
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!firebaseConfigured && (
              <div className="flex items-center gap-1.5">
                <span className="hidden text-xs text-slate-400 sm:block">View as:</span>
                {(["champion", "mentor", "mentee"] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRoleSwitch(r)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition ${
                      role === r
                        ? "bg-slate-950 text-white"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
            <span className="hidden text-sm text-slate-500 sm:block">
              {firebaseConfigured ? user?.email : MOCK_ROLE_USERS[role ?? "champion"]?.email}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
