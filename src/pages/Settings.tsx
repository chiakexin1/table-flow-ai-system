"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getOrCreateRestaurantForCurrentUser } from "@/services/restaurantService";
import type { Restaurant } from "@/services/restaurantService";
import {
  showSuccess,
  showError,
  showLoading,
  dismissToast,
} from "@/utils/toast";

/* ------------------------------------------------------------------
   Helper – list of week days used for opening‑hours editing.
   ------------------------------------------------------------------ */
const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type OpeningHoursDay = {
  open: string; // HH:MM
  close: string; // HH:MM
  closed: boolean;
};

type OpeningHours = Record<(typeof WEEK_DAYS)[number], OpeningHoursDay>;

export default function Settings() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- Form fields (controlled) ---------- */
  const [name, setName] = useState<string>("");
  const [contactPhone, setContactPhone] = useState<string>("");
  const [timezone, setTimezone] = useState<string>("");
  const [maxPartySize, setMaxPartySize] = useState<number>(1);
  const [openingHours, setOpeningHours] = useState<OpeningHours>({} as OpeningHours);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  /* ---------- Load restaurant (or bootstrap) ---------- */
  useEffect(() => {
    let cancelled = false;
    const fetchRestaurant = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getOrCreateRestaurantForCurrentUser();
        if (!cancelled) {
          setRestaurant(data);
          // Populate form fields from fetched data
          setName(data.name ?? "");
          setContactPhone(data.contact_phone ?? "");
          setTimezone(data.timezone ?? "");
          setMaxPartySize(data.max_party_size ?? 1);
          // Opening hours may be null or {} – normalise to full structure
          const raw = data.opening_hours as any;
          const normalized: OpeningHours = {} as OpeningHours;
          WEEK_DAYS.forEach((day) => {
            const dayData = raw?.[day];
            if (dayData) {
              normalized[day] = {
                open: dayData.open ?? "",
                close: dayData.close ?? "",
                closed: !!dayData.closed,
              };
            } else {
              normalized[day] = { open: "", close: "", closed: false };
            }
          });
          setOpeningHours(normalized);
        }
      } catch (err: any) {
        console.error("[Settings] failed to load restaurant:", err);
        if (!cancelled) {
          setError(err?.message ?? "Failed to load restaurant settings.");
          showError(err?.message ?? "Failed to load restaurant settings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRestaurant();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Validation helpers ---------- */
  const phoneRegex = /^[+]?[\d\s-]{7,15}$/;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!name.trim()) {
      errs.name = "Restaurant name is required.";
    }

    if (!timezone.trim()) {
      errs.timezone = "Timezone is required.";
    }

    if (!Number.isInteger(maxPartySize) || maxPartySize < 1 || maxPartySize > 20) {
      errs.maxPartySize = "Maximum party size must be an integer between 1 and 20.";
    }

    if (contactPhone && !phoneRegex.test(contactPhone.trim())) {
      errs.contactPhone = "Enter a valid phone number (e.g., +60123456789).";
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ---------- Save handler ---------- */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    if (!validate()) return;

    setSaveLoading(true);
    const toastId = showLoading("Saving settings…");

    // Prepare payload – omit optional fields when empty to store null
    const payload: Record<string, any> = {
      name: name.trim(),
      timezone: timezone.trim(),
      max_party_size: maxPartySize,
      opening_hours: openingHours,
    };

    // contact_phone: if empty string -> null, else trimmed string
    payload.contact_phone = contactPhone.trim() ? contactPhone.trim() : null;

    try {
      const { error: updError } = await supabase
        .from("restaurants")
        .update(payload)
        .eq("id", restaurant.id);

      if (updError) throw updError;

      // Optimistically update local state
      setRestaurant((prev) =>
        prev
          ? {
              ...prev,
              name: payload.name,
              contact_phone: payload.contact_phone,
              timezone: payload.timezone,
              max_party_size: payload.max_party_size,
              opening_hours: payload.opening_hours,
            }
          : prev,
      );

      dismissToast(toastId);
      showSuccess("Restaurant settings saved successfully.");
    } catch (err: any) {
      console.error("[Settings] update failed:", err);
      dismissToast(toastId);
      showError(err?.message ?? "Failed to save restaurant settings.");
    } finally {
      setSaveLoading(false);
    }
  };

  /* ---------- UI helpers ---------- */
  const renderError = (field: string) =>
    validationErrors[field] ? (
      <p className="mt-1 text-sm text-destructive">{validationErrors[field]}</p>
    ) : null;

  const handleDayChange = (
    day: (typeof WEEK_DAYS)[number],
    field: keyof OpeningHoursDay,
    value: string | boolean,
  ) => {
    setOpeningHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  // ---------- Rendering ----------
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground animate-pulse">
          Loading restaurant settings…
        </span>
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

  if (!restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">No restaurant data available.</p>
      </div>
    );
  }

  return (
    <section className="max-w-2xl mx-auto p-6 bg-card rounded-lg shadow">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Restaurant Settings</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Restaurant Name */}
        <div>
          <label className="block mb-1 font-medium text-foreground">
            Restaurant Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              validationErrors.name ? "border-destructive" : "border-input"
            }`}
          />
          {renderError("name")}
        </div>

        {/* Contact Phone */}
        <div>
          <label className="block mb-1 font-medium text-foreground">Contact Phone</label>
          <input
            type="text"
            value={contactPhone}
            placeholder="e.g., +60123456789"
            onChange={(e) => setContactPhone(e.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              validationErrors.contactPhone ? "border-destructive" : "border-input"
            }`}
          />
          {renderError("contactPhone")}
        </div>

        {/* Timezone */}
        <div>
          <label className="block mb-1 font-medium text-foreground">
            Timezone <span className="text-destructive">*</span>
          </label>
          {/* For prototype a simple text input – could be a select later */}
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              validationErrors.timezone ? "border-destructive" : "border-input"
            }`}
          />
          {renderError("timezone")}
        </div>

        {/* Maximum Party Size */}
        <div>
          <label className="block mb-1 font-medium text-foreground">
            Maximum Party Size <span className="text-destructive">*</span>
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={maxPartySize}
            onChange={(e) => setMaxPartySize(Number(e.target.value))}
            className={`w-24 rounded-md border px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              validationErrors.maxPartySize ? "border-destructive" : "border-input"
            }`}
          />
          {renderError("maxPartySize")}
        </div>

        {/* Opening Hours */}
        <div className="border border-border rounded-md p-4 bg-background">
          <h2 className="text-lg font-medium text-foreground mb-4">Opening Hours</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="space-y-2 p-2 border rounded">
                <h3 className="capitalize text-sm font-medium text-foreground">{day}</h3>

                <label className="block text-xs text-muted-foreground">Closed</label>
                <input
                  type="checkbox"
                  checked={openingHours[day]?.closed ?? false}
                  onChange={(e) => handleDayChange(day, "closed", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus-visible:ring-primary"
                />

                {/* When not closed, show open/close times */}
                {!openingHours[day]?.closed && (
                  <>
                    <label className="block text-xs text-muted-foreground">Open</label>
                    <input
                      type="time"
                      value={openingHours[day]?.open ?? ""}
                      onChange={(e) => handleDayChange(day, "open", e.target.value)}
                      className="w-full rounded-md border px-2 py-1 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary border-input"
                    />

                    <label className="block text-xs text-muted-foreground">Close</label>
                    <input
                      type="time"
                      value={openingHours[day]?.close ?? ""}
                      onChange={(e) => handleDayChange(day, "close", e.target.value)}
                      className="w-full rounded-md border px-2 py-1 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary border-input"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-4">
          <Button
            type="submit"
            disabled={saveLoading}
            className={`bg-primary text-primary-foreground hover:bg-primary/90 ${
              saveLoading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {saveLoading ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </form>
    </section>
  );
}