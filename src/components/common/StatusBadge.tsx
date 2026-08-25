"use client";

type StatusBadgeProps = {
  status: "pending" | "confirmed" | "cancelled" | "no_show" | "escalated";
};

const statusMap: Record<StatusBadgeProps["status"], { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground" },
  confirmed: { label: "Confirmed", color: "bg-primary text-primary-foreground" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700"},
  cancelled: { label: "Cancelled", color: "bg-destructive text-destructive-foreground" },
  no_show: { label: "No‑Show", color: "bg-accent text-accent-foreground" },
  escalated: { label: "Escalated", color: "bg-warning/20 text-warning" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { label, color } = statusMap[status];
  return (
    <span
      className={`
        inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
        ${color}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
      `}
    >
      {label}
    </span>
  );
}