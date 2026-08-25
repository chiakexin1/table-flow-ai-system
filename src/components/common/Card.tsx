"use client";

type CardProps = {
  title: string;
  description: string;
};

export default function Card({ title, description }: CardProps) {
  return (
    <div className="p-4 bg-card rounded-lg shadow-sm border border-border">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
  );
}