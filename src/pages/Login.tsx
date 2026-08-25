"use client";

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/common/Button";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const errs: typeof fieldErrors = {};

    if (!email.trim()) {
      errs.email = "Email is required.";
    } else if (!emailRegex.test(email.trim())) {
      errs.email = "Enter a valid email address.";
    }

    if (!password) {
      errs.password = "Password is required.";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await signIn(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      // Supabase returns an AuthError with a message property
      setFormError(err?.message ?? "Sign‑in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-md mx-auto mt-12 p-6 bg-card rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4 text-primary">TableFlow AI Login</h1>
      <p className="mb-6 text-muted-foreground">
        Sign in to manage your restaurant’s bookings and AI‑assistant.
      </p>

      {/* Show a top‑level error if Supabase rejects the credentials */}
      {formError && (
        <div className="mb-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-destructive">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium text-foreground">
            Email <span className="text-destructive">*</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            disabled={submitting}
            className={`w-full rounded-md border px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              fieldErrors.email ? "border-destructive" : "border-input"
            }`}
          />
          {fieldErrors.email && (
            <p className="mt-1 text-sm text-destructive">{fieldErrors.email}</p>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium text-foreground">
            Password <span className="text-destructive">*</span>
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            disabled={submitting}
            className={`w-full rounded-md border px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              fieldErrors.password ? "border-destructive" : "border-input"
            }`}
          />
          {fieldErrors.password && (
            <p className="mt-1 text-sm text-destructive">{fieldErrors.password}</p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {submitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      {/* Secondary link for future account creation */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link to="#" className="text-primary hover:underline">
          Create test account
        </Link>
      </p>
    </section>
  );
}