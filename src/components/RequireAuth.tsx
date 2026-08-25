"use client";

import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Protects a route by checking Supabase auth state.
 *
 * - While the auth state is being restored (`loading`), a minimal
 *   loading indicator is shown.
 * - If no authenticated user is present, the user is redirected to
 *   `/login`.
 * - If the user is authenticated, the wrapped children are rendered.
 */
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 1️⃣ Still figuring out whether a session exists – show a tiny spinner
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground animate-pulse">Loading…</span>
      </div>
    );
  }

  // 2️⃣ No user → send them to the public login page
  if (!user) {
    // Preserve the attempted location in state (useful later for redirects)
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 3️⃣ Authenticated – render the protected UI
  return <>{children}</>;
};