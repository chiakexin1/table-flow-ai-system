"use client";

import { Link } from "react-router-dom";
import { useBooking } from "@/context/BookingContext";
import Button from "@/components/common/Button";
import StatusBadge from "@/components/common/StatusBadge";

const Bookings = () => {
  const { bookings } = useBooking();

  // Sort by combined date+time, nearest upcoming first
  const sortedBookings = React.useMemo(() => {
    return [...bookings].sort((a, b) => {
      const aDate = new Date(`${a.bookingDate}T${a.bookingTime}`);
      const bDate = new Date(`${b.bookingDate}T${b.bookingTime}`);
      return aDate.getTime() - bDate.getTime();
    });
  }, [bookings]);

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
                    <td className="px-4 py-2 text-sm text-foreground">{b.source}</td>
                    <td className="px-4 py-2 text-sm text-foreground">
                      {b.handledByAI ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-2 text-sm text-foreground">
                      <StatusBadge status={badgeStatus} />
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