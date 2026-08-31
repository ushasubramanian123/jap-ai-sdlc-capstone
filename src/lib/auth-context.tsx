"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, hasFirebaseConfig } from "./firebase";
import { getUserRole } from "./firestore-helpers";

export type UserRole = "champion" | "mentor" | "mentee" | null;

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole;
  loading: boolean;
  firebaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchMockRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Mock user for development when Firebase is not configured
 */
const MOCK_USER: AuthUser = {
  uid: "mock-user-001",
  email: "demo@epam.com",
  displayName: "Demo User",
};

const isMockMode = !hasFirebaseConfig || !auth;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(isMockMode ? MOCK_USER : null);
  const [role, setRole] = useState<UserRole>(isMockMode ? "champion" : null);
  const [loading, setLoading] = useState(!isMockMode);

  useEffect(() => {
    if (isMockMode) return;

    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth!, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        });
        const fetchedRole = await getUserRole(firebaseUser.uid);
        setRole(fetchedRole ?? "mentee");
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) {
      throw new Error("Firebase not configured");
    }
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    if (!auth) {
      throw new Error("Firebase not configured");
    }
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    if (!auth) {
      setUser(null);
      setRole(null);
      return;
    }
    await signOut(auth);
  };

  const switchMockRole = (newRole: UserRole) => {
    if (!isMockMode) return;
    setRole(newRole);
  };

  const value: AuthContextType = {
    user,
    role,
    loading,
    firebaseConfigured: hasFirebaseConfig,
    signIn,
    signUp,
    logout,
    switchMockRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
