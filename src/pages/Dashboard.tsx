"use client";

import Card from "@/components/common/Card";

const Dashboard = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
      <Card title="Today's Bookings" description="0" />
      <Card title="Weekly Bookings" description="0" />
      <Card title="No‑Show Rate" description="0 %" />
      <Card title="AI‑Handled Enquiries" description="0" />
    </div>
  </div>
);

export default Dashboard;