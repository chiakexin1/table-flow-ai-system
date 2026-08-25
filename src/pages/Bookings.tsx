"use client";

import { Link } from "react-router-dom";
import { useBooking } from "@/context/BookingContext";
import Button from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";
import { showSuccess } from "@/utils/toast";
import React from "react";

const Bookings = () => {
  const { bookings, loading, error, updateBookingStatus } = useBooking();

  // Sort bookings by date & time (already ordered by DB, but keep deterministic order)
  const sortedBookings = React.useMemo(() => {
    return [...bookings].sort((a, b) => {
      const aDate = new Date(`${a.bookingDate}T${a.bookingTime}`);
      const bDate = new Date(`${b.bookingDate}T${b.bookingTime}`);
      return aDate.getTime() - bDate.getTime();
    });
  }, [bookings]);

  const statusOptions = [
    "Pending",
    "Confirmed",
    "Completed",
    "Cancelled",
    "No-show",
    "Escalated",
  ] as const;

  const handleStatusChange = (
    id: string,
    newStatus: typeof statusOptions[number],
  ) => {
    updateBookingStatus(id, newStatus);
    showSuccess("Booking status updated successfully");
  };

  // ----- Loading state ---------------------------------------------------
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground animate-pulse">
          Loading bookings…
        </span>
      </div>
    );
  }

  // ----- Error state -----------------------------------------------------
  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        <p className="mb-4">{error}</p>
        <Link to="/dashboard">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // ----- Main UI ---------------------------------------------------------
  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Bookings</h1>
        <Link to="/bookings/new">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            + New Booking
          </Button>
        </Link>
      </div>

      {/* Content */}
      {sortedBookings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-4 text-lg">No bookings found.</p>
          <Link to="/bookings/new">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              Create Booking
            </Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-foreground">
                  Customer
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
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {sortedBookings.map((b) => {
                const badgeStatus = b.status
                  .toLowerCase()
                  .replace("-", "_") as any; // matches StatusBadge keys

                return (
                  <tr key={b.id} className="hover:bg-muted/50">
                    <td className="px-4 py-2 text-sm text-foreground">
                      {b.customerName}
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
                    <td className="px-4 py-2 text-sm text-foreground">
                      {b.source}
                    </td>
                    <td className="px-4 py-2 text-sm text-foreground">
                      {b.handledByAI ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-2 text-sm text-foreground flex items-center gap-2">
                      <StatusBadge status={badgeStatus} />
                      <select
                        value={b.status}
                        onChange={(e) =>
                          handleStatusChange(
                            b.id,
                            e.target.value as typeof statusOptions[number],
                          )
                        }
                        className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default Bookings;