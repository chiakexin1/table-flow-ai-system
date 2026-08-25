import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Explicitly fail if environment variables are not provided
if (!SUPABASE_URL) {
  throw new Error(
    "Supabase URL is missing. Set VITE_SUPABASE_URL in your environment (e.g., .env file).",
  );
}
if (!SUPABASE_ANON_KEY) {
  throw new Error(
    "Supabase anon key is missing. Set VITE_SUPABASE_ANON_KEY in your environment (e.g., .env file).",
  );
}

// Export a ready‑to‑use client instance
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);