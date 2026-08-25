"use client";

type SuccessMessageProps = {
  message: string;
};

export default function SuccessMessage({ message }: SuccessMessageProps) {
  return (
    <div className="border border-success/30 bg-success/10 text-success rounded-md p-3">
      {message}
    </div>
  );
}