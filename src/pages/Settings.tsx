"use client";

import { useEffect, useState } from "react";
import { getOrCreateRestaurantForCurrentUser } from "@/services/restaurantService";
import { Restaurant } from "@/services/restaurantService";
import { showError } from "@/utils/toast";

export default function Settings() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load (or bootstrap) the restaurant belonging to the authenticated user
  useEffect(() => {
    let cancelled = false;
    const fetchRestaurant = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getOrCreateRestaurantForCurrentUser();
        if (!cancelled) setRestaurant(data);
      } catch (err: any) {
        console.error("[Settings] failed to load restaurant:", err);
        if (!cancelled) setError(err?.message ?? "Failed to load restaurant settings.");
        // Show a toast for immediate feedback
        showError(err?.message ?? "Failed to load restaurant settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRestaurant();

    return () => {
      cancelled = true;
    };
    // No dependencies – run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- UI ----------
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground animate-pulse">Loading restaurant settings…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center text-destructive">
          <p className="mb-4">{error}</p>
        </div>
      </div>
    );
  }

  // If for some reason restaurant is null (shouldn't happen because bootstrap creates one), show fallback
  if (!restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">No restaurant data available.</p>
      </div>
    );
  }

  // Helper to render a field with fallback
  const renderField = (label: string, value: unknown) => (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{label}</h3>
      <p className="text-lg text-foreground">
        {value === null || value === undefined || (typeof value === "string" && value.trim() === "")
          ? "Not set"
          : typeof value === "object"
          ? JSON.stringify(value, null, 2)
          : String(value)}
      </p>
    </div>
  );

  return (
    <section className="max-w-2xl mx-auto p-6 bg-card rounded-lg shadow">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Restaurant Settings</h1>

      {renderField("Restaurant Name", restaurant.name)}
      {renderField("Contact Phone", restaurant.contact_phone)}
      {renderField("Timezone", restaurant.timezone)}
      {renderField("Maximum Party Size", restaurant.max_party_size)}
      {renderField("Opening Hours", restaurant.opening_hours)}
    </section>
  );
}