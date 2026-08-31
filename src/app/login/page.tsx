"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { signIn, firebaseConfigured } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(friendlyError(message));
    } finally {
      setLoading(false);
    }
  }

  if (!firebaseConfigured) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fff9eb_0%,#f4f7fb_42%,#eef3f8_100%)] flex items-center justify-center px-5">
        <div className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">Demo Mode</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-950">Firebase not configured</h1>
          <p className="mt-3 text-sm text-slate-600 leading-6">
            Add your Firebase credentials to <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">.env.local</code> to enable real login. Running in mock mode.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 w-full rounded-2xl bg-slate-950 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Continue as demo user
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff9eb_0%,#f4f7fb_42%,#eef3f8_100%)] flex items-center justify-center px-5">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
            Junior Adoption Program
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter your credentials to access the dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@epam.com"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-2xl bg-slate-950 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Please wait…" : "Sign in"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

function friendlyError(message: string): string {
  if (message.includes("user-not-found") || message.includes("wrong-password") || message.includes("invalid-credential")) {
    return "Incorrect email or password.";
  }
  if (message.includes("email-already-in-use")) {
    return "An account with this email already exists.";
  }
  if (message.includes("weak-password")) {
    return "Password must be at least 6 characters.";
  }
  if (message.includes("invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (message.includes("too-many-requests")) {
    return "Too many attempts. Please try again later.";
  }
  return "Something went wrong. Please try again.";
}
