"use client";

import React from "react";
import { Link } from "react-router-dom";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { useBooking } from "@/context/BookingContext";
import { StatusChart } from "@/components/dashboard/StatusChart";
import { TrendChart } from "@/components/dashboard/TrendChart";

/**
 * Dashboard – shows operational KPIs for the authenticated restaurant.
 *
 * New features:
 *   • Quick Actions (navigation shortcuts)
 *   • Conditional navigation links in Attention Needed
 *   • “View All Bookings” link in Recent Bookings
 *   • Existing KPI cards, charts, and sections remain unchanged
 */
const Dashboard = () => {
  const { bookings, loading } = useBooking();

  /* ---------- Loading UI ---------- */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground animate-pulse">
          Loading dashboard…
        </span>
      </div>
    );
  }

  /* ---------- Helper: parse booking date+time into a Date object ---------- */
  const parseDateTime = (date: string, time: string) => {
    // date: "YYYY-MM-DD", time: "HH:MM"
    const iso = `${date}T${time}:00`;
    return new Date(iso);
  };

  /* ---------- KPI Calculations ---------- */
  const todayStr = new Date().toISOString().slice(0, 10); // client local date (YYYY‑MM‑DD)

  const todayCount = React.useMemo(
    () => bookings.filter((b) => b.bookingDate === todayStr).length,
    [bookings, todayStr],
  );

  const weeklyCount = React.useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0); // start of today
    const end = new Date(start);
    end.setDate(end.getDate() + 6); // today + 6 = 7‑day window

    return bookings.filter((b) => {
      const d = new Date(b.bookingDate);
      return d >= start && d <= end;
    }).length;
  }, [bookings]);

  const noShowRate = React.useMemo(() => {
    const total = bookings.length;
    if (total === 0) return 0;
    const noShow = bookings.filter((b) => b.status === "No-show").length;
    return Math.round((noShow / total) * 100);
  }, [bookings]);

  const aiHandled = React.useMemo(
    () => bookings.filter((b) => b.handledByAI).length,
    [bookings],
  );

  const pendingCount = React.useMemo(
    () => bookings.filter((b) => b.status === "Pending").length,
    [bookings],
  );

  const openEscalationsCount = React.useMemo(
    () => bookings.filter((b) => b.status === "Escalated").length,
    [bookings],
  );

  /* ---------- Status counts for chart ---------- */
  const statusCounts = React.useMemo(() => {
    const init = {
      Pending: 0,
      Confirmed: 0,
      Completed: 0,
      Cancelled: 0,
      "No-show": 0,
      Escalated: 0,
    };
    bookings.forEach((b) => {
      const s = b.status as keyof typeof init;
      if (init[s] !== undefined) {
        init[s] += 1;
      }
    });
    return init;
  }, [bookings]);

  /* ---------- Recent Bookings (max 5) ---------- */
  const recentBookings = React.useMemo(() => {
    const sorted = [...bookings].sort((a, b) => {
      const aDt = parseDateTime(a.bookingDate, a.bookingTime);
      const bDt = parseDateTime(b.bookingDate, b.bookingTime);
      return bDt.getTime() - aDt.getTime(); // newest first
    });
    return sorted.slice(0, 5);
  }, [bookings]);

  /* ---------- Render ---------- */
  return (
    <div className="space-y-8">
      {/* ==== KPI GRID ==== */}
      <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card title="Today's Bookings" description={String(todayCount)} />
        <Card title="Weekly Bookings" description={String(weeklyCount)} />
        <Card title="No‑Show Rate" description={`${noShowRate}%`} />
        <Card title="AI‑Handled Enquiries" description={String(aiHandled)} />
        <Card title="Pending Bookings" description={String(pendingCount)} />
        <Card
          title="Open Escalations"
          description={String(openEscalationsCount)}
        />
      </div>

      {/* ==== QUICK ACTIONS ==== */}
      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="text-2xl font-semibold text-foreground mb-3">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/bookings/new">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              New Booking
            </Button>
          </Link>
          <Link to="/bookings">
            <Button className="bg-muted text-muted-foreground hover:bg-muted/80">
              View Bookings
            </Button>
          </Link>
          <Link to="/escalations">
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Review Escalations
            </Button>
          </Link>
          <Link to="/settings">
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              Restaurant Settings
            </Button>
          </Link>
          <Link to="/ai-advisor">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              Ask AI Advisor
            </Button>
          </Link>
        </div>
      </section>

      {/* ==== CHARTS SECTION (responsive) ==== */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatusChart statusCounts={statusCounts} />
        <TrendChart bookings={bookings} />
      </div>

      {/* ==== ATTENTION NEEDED SECTION ==== */}
      <section className="rounded-md border border-border bg-card p-6">
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Attention Needed
        </h2>

        {pendingCount === 0 && openEscalationsCount === 0 ? (
          <p className="text-muted-foreground">
            No bookings currently require attention.
          </p>
        ) : (
          <ul className="list-disc pl-5 space-y-2 text-foreground">
            {pendingCount > 0 && (
              <li className="flex items-center justify-between">
                <span>{`Pending bookings: ${pendingCount}`}</span>
                <Link to="/bookings">
                  <Button className="ml-4 bg-muted text-muted-foreground hover:bg-muted/80">
                    View Bookings
                  </Button>
                </Link>
              </li>
            )}
            {openEscalationsCount > 0 && (
              <li className="flex items-center justify-between">
                <span>{`Open escalations: ${openEscalationsCount}`}</span>
                <Link to="/escalations">
                  <Button className="ml-4 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Review Escalations
                  </Button>
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* ==== RECENT BOOKINGS SECTION ==== */}
      <section className="rounded-md border border-border bg-card p-6">
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Recent Bookings
        </h2>

        {recentBookings.length === 0 ? (
          <p className="text-muted-foreground">No bookings yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
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
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2 text-sm text-foreground">{b.customerName}</td>
                      <td className="px-4 py-2 text-sm text-foreground">{b.bookingDate}</td>
                      <td className="px-4 py-2 text-sm text-foreground">{b.bookingTime}</td>
                      <td className="px-4 py-2 text-sm text-foreground">{b.partySize}</td>
                      <td className="px-4 py-2 text-sm text-foreground">{b.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-right">
              <Link to="/bookings">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  View All Bookings
                </Button>
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default Dashboard;