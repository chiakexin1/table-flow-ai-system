"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";

type StatusCounts = Record<
  "Pending" | "Confirmed" | "Completed" | "Cancelled" | "No-show" | "Escalated",
  number
>;

type Props = {
  statusCounts: StatusCounts;
};

const COLORS = [
  "#6366F1", // primary
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#A78BFA", // purple
  "#F472B6", // pink
];

export const StatusChart = ({ statusCounts }: Props) => {
  const data = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
  }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h2 className="text-lg font-semibold text-foreground mb-2">
        Booking Status Breakdown
      </h2>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No booking data.</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              labelLine={false}
            >
              <LabelList
                position="outside"
                formatter={(value) => `${value}`}
                style={{ fontSize: "0.75rem" }}
              />
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [value, "Bookings"]}
              cursor={{ fill: "transparent" }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </section>
  );
};