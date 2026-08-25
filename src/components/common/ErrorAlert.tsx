"use client";

type ErrorAlertProps = {
  title?: string;
  children: React.ReactNode;
};

export default function ErrorAlert({ title = "Error", children }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className="border border-destructive/30 bg-destructive/10 text-destructive rounded-md p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
    >
      <strong className="block mb-2">{title}</strong>
      <div>{children}</div>
    </div>
  );
}