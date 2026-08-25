"use client";

import EmptyState from "@/components/common/EmptyState";

const Escalations = () => (
  <section className="space-y-4">
    <h1 className="text-3xl font-bold text-foreground">Escalations</h1>
    <EmptyState message="No escalated conversations yet." />
  </section>
);

export default Escalations;