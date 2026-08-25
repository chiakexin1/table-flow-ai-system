"use client";

import React from "react";
import Card from "@/components/common/Card";
import { useBooking } from "@/context/BookingContext";

const Dashboard = () => {
  const { bookings, loading } = useBooking();

  // ---------- Loading UI ----------
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground animate-pulse">Loading dashboard…</span>
      </div>
    );
  }

  // ---------- KPI calculations ----------
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY‑MM‑DD (local)

  // Today’s bookings
  const todayCount = React.useMemo(
    () => bookings.filter((b) => b.bookingDate === todayStr).length,
    [bookings, todayStr],
  );

  // Weekly bookings – week starts on Sunday
  const weeklyCount = React.useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay()); // Sunday

    const end = new Date(start);
    end.setDate(end.getDate() + 6); // Saturday

    return bookings.filter((b) => {
      const d = new Date(b.bookingDate);
      return d >= start && d <= end;
    }).length;
  }, [bookings]);

  // No‑show rate
  const noShowRate = React.useMemo(() => {
    const total = bookings.length;
    if (total === 0) return 0;
    const noShow = bookings.filter((b) => b.status === "No-show").length;
    return Math.round((noShow / total) * 100);
  }, [bookings]);

  // AI‑handled enquiries
  const aiHandled = React.useMemo(
    () => bookings.filter((b) => b.handledByAI).length,
    [bookings],
  );
  // ---------------------------------------

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <Card title="Today's Bookings" description={String(todayCount)} />
        <Card title="Weekly Bookings" description={String(weeklyCount)} />
        <Card title="No‑Show Rate" description={`${noShowRate}%`} />
        <Card title="AI‑Handled Enquiries" description={String(aiHandled)} />
      </div>
    </div>
  );
};

export default Dashboard;