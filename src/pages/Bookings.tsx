"use client";

import { Link } from "react-router-dom";
import { useBooking } from "@/context/BookingContext";
import Button from "@/components/common/Button";
import BookingTable from "@/components/common/BookingTable";

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
        <BookingTable bookings={sortedBookings} />
      )}
    </section>
  );
};

export default Bookings;