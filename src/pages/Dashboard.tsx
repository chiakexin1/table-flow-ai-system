"use client";

import Card from "@/components/common/Card";

const Dashboard = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card title="Total Bookings" description="0 (YTD)" />
      <Card title="Confirmed Rate" description="0 %" />
      <Card title="No‑Show Rate" description="0 %" />
    </div>
  </div>
);

export default Dashboard;