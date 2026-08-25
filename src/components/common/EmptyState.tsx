"use client";

type EmptyStateProps = {
  message: string;
  icon?: React.ReactNode;
};

export default function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      {icon && <div className="mb-4">{icon}</div>}
      <p className="text-lg">{message}</p>
    </div>
  );
}