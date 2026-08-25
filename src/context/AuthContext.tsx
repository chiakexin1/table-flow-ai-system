"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";
import type {
  Session,
  User,
  AuthError,
  Provider,
} from "@supabase/supabase-js";

// Import the restaurant bootstrap helper
import { getOrCreateRestaurantForCurrentUser } from "@/services/restaurantService";

/**
 * Shape of the value exported by the AuthContext.
 */
interface AuthContextValue {
  /** Currently authenticated user (null if not signed in) */
  user: User | null;
  /** Current Supabase session (null if not signed in) */
  session: Session | null;
  /** True while the initial session is being restored */
  loading: boolean;
  /** Sign‑in with email & password */
  signIn: (email: string, password: string) => Promise<User>;
  /** Sign‑up with email & password */
  signUp: (email: string, password: string) => Promise<User>;
  /** Sign‑out of the current session */
  signOut: () => Promise<void>;
}

/** Create context – undefined until provider is mounted */
const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

/**
 * AuthProvider – wraps the app and supplies authentication state/functionality.
 *
 * It:
 *   1. Restores any existing session on first render.
 *   2. Subscribes to Supabase auth state changes.
 *   3. Exposes user, session, loading and helper functions.
 *   4. **Bootstraps a restaurant for the signed‑in user** (new step).
 */
export const AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  /** Restore session once on component mount */
  React.useEffect(() => {
    const restore = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("[AuthProvider] error restoring session", error);
      }

      setSession(session ?? null);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    restore();
  }, []);

  /** Listen for auth state changes (sign‑in, sign‑out, token refresh, etc.) */
  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    // Cleanup subscription when component unmounts
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  /** -----------------------------------------------------------------
   *  NEW: Bootstrap a restaurant record as soon as we have a valid user.
   *  ----------------------------------------------------------------- */
  React.useEffect(() => {
    // Run only when a user becomes available (skip null -> unauthenticated)
    if (user) {
      // Wrap in an async IIFE to avoid making the effect itself async
      (async () => {
        try {
          const restaurant = await getOrCreateRestaurantForCurrentUser();
          console.info("[AuthProvider] restaurant bootstrap OK", {
            restaurantId: restaurant.id,
            ownerId: restaurant.owner_id,
          });
        } catch (err: any) {
          console.error("[AuthProvider] restaurant bootstrap failed:", err);
        }
      })();
    }
    // We only depend on `user` – when it changes from null → user we run once.
  }, [user]);

  /** Helper – sign in with email & password */
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Propagate the error so UI can display it
      throw error;
    }

    // signInWithPassword returns a Session object
    // Update local state to keep it in sync (in case the onAuthStateChange runs later)
    setSession(data.session);
    setUser(data.session?.user ?? null);
    return data.session?.user as User;
  };

  /** Helper – sign up with email & password */
  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // Immediately after sign‑up Supabase may or may not create a session
    // (depends on email confirmation settings). We still update state.
    setSession(data.session ?? null);
    setUser(data.session?.user ?? null);
    return data.session?.user as User;
  };

  /** Helper – sign out the current user */
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    // Local state will also be cleared by the onAuthStateChange listener,
    // but we clear it here for immediacy.
    setUser(null);
    setSession(null);
  };

  const value: AuthContextValue = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook for easy consumption of the auth context.
 * Throws if used outside of an AuthProvider.
 */
export const useAuth = (): AuthContextValue => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};