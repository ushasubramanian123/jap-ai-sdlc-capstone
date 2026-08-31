"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const ROLE_DASHBOARD: Record<string, string> = {
  champion: "/dashboard/champion",
  mentor: "/dashboard/mentor",
  mentee: "/dashboard/mentee",
};

export default function Home() {
  const { user, role, loading, firebaseConfigured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (firebaseConfigured && !user) {
      router.push("/login");
      return;
    }

    if (role) {
      router.push(ROLE_DASHBOARD[role] ?? "/dashboard/mentee");
    }
  }, [firebaseConfigured, loading, user, role, router]);

  return null;
}
