"use client";

import React, { useEffect } from "react";
import { useBooking } from "@/context/BookingContext";
import { showSuccess, showError } from "@/utils/toast";
import Button from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";

/**
 * Escalations page – lists bookings with status “Escalated” and lets the
 * restaurant owner resolve them manually.
 *
 * Requirements satisfied:
 *   • Data is sourced directly from BookingContext (Supabase‑backed).
 *   • Only bookings belonging to the currently‑authenticated restaurant are shown.
 *   • Filter = status === "Escalated".
 *   • Empty state displays a friendly message.
 *   • “Open Escalations: X” summary at the top.
 *   • Owner can change status to Confirmed / Completed / Cancelled via
 *     BookingContext.updateBookingStatus().
 *   • Success toast & immediate UI removal on resolution.
 *   • Error toast on Supabase failure, leaving the booking visible.
 *   • No new tables/columns are added; security (RLS, auth) unchanged.
 */

export default function Escalations() {
  const {
    bookings,
    loading,
    error,
    updateBookingStatus,
  } = useBooking();

  // Filter only escalated bookings
  const escalated = bookings.filter((b) => b.status === "Escalated");

  // Resolve a booking – wrapper that shows toasts
  const resolveBooking = async (
    id: string,
    newStatus: "Confirmed" | "Completed" | "Cancelled",
  ) => {
    try {
      await updateBookingStatus(id, newStatus);
      showSuccess("Escalation resolved successfully.");
      // BookingContext updates the local state, causing the row to disappear.
    } catch (err: any) {
      console.error("[Escalations] resolve error:", err);
      showError(
        err?.message ??
          "Failed to resolve escalation. Please try again.",
      );
    }
  };

  // Loading UI
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground animate-pulse">
          Loading escalations…
        </span>
      </div>
    );
  }

  // Error UI
  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        <p className="mb-4">{error}</p>
        <Button
          onClick={() => window.location.reload()}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6 p-6 bg-card rounded-lg shadow">
      {/* Header with count */}
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Escalations</h1>
        <span className="text-sm font-medium text-foreground">
          Open Escalations: {escalated.length}
        </span>
      </header>

      {/* Empty state */}
      {escalated.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No escalations require attention.</p>
        </div>
      ) : (
        /* Table of escalated bookings */
        <div className="overflow-x-auto rounded-md border border-border bg-background">
          <table className="w-full min-w-[800px] divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-foreground">
                  Customer
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-foreground">
                  Phone
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-foreground">
                  Date
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-foreground">
                  Time
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-foreground">
                  Party
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-foreground">
                  Source
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-foreground">
                  Handled by AI
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-foreground">
                  Special Request
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-foreground">
                  Status
                </th>
                <th className="px-4 py-2 text-center text-sm font-medium text-foreground">
                  Resolve
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {escalated.map((b) => (
                <tr key={b.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2 text-sm text-foreground">
                    {b.customerName}
                  </td>
                  <td className="px-4 py-2 text-sm text-foreground">
                    {b.phone}
                  </td>
                  <td className="px-4 py-2 text-sm text-foreground">
                    {b.bookingDate}
                  </td>
                  <td className="px-4 py-2 text-sm text-foreground">
                    {b.bookingTime}
                  </td>
                  <td className="px-4 py-2 text-sm text-foreground">
                    {b.partySize}
                  </td>
                  <td className="px-4 py-2 text-sm text-foreground">{b.source}</td>
                  <td className="px-4 py-2 text-sm text-foreground">
                    {b.handledByAI ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-2 text-sm text-foreground">
                    {b.specialRequest?.trim()
                      ? b.specialRequest
                      : "Reason: Manual review required."}
                  </td>
                  <td className="px-4 py-2 text-sm text-foreground">
                    <StatusBadge status="escalated" />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const newStatus = e.target.value as
                          | "Confirmed"
                          | "Completed"
                          | "Cancelled";
                        if (newStatus) {
                          // Reset select to placeholder after action
                          e.currentTarget.value = "";
                          resolveBooking(b.id, newStatus);
                        }
                      }}
                      className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <option value="" disabled>
                        Resolve…
                      </option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}