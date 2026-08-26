"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Booking = {
  id: string;
  bookingDate: string; // YYYY‑MM‑DD
  // other fields ignored for trend
};

type Props = {
  bookings: Booking[];
};

const generateTrendData = (bookings: Booking[]) => {
  const today = new Date();
  const data: { dateLabel: string; count: number }[] = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() + i);
    const iso = day.toISOString().slice(0, 10); // YYYY‑MM‑DD
    const label = day.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    data.push({ dateLabel: label, count: 0, iso });
  }

  // tally bookings
  bookings.forEach((b) => {
    const index = data.findIndex((d) => d.iso === b.bookingDate);
    if (index !== -1) {
      data[index].count += 1;
    }
  });

  // Remove temporary iso property before returning to UI
  return data.map(({ dateLabel, count }) => ({ dateLabel, count }));
};

export const TrendChart = ({ bookings }: Props) => {
  const data = React.useMemo(() => generateTrendData(bookings), [bookings]);

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h2 className="text-lg font-semibold text-foreground mb-2">
        7‑Day Booking Trend
      </h2>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings in the next 7 days.</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <XAxis dataKey="dateLabel" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" name="Bookings" fill="#6366F1" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
};