"use client";

type LoadingSkeletonProps = {
  className?: string;
};

export default function LoadingSkeleton({ className = "" }: LoadingSkeletonProps) {
  return (
    <div
      className={`
        animate-pulse rounded-md bg-muted ${className}
      `}
    />
  );
}