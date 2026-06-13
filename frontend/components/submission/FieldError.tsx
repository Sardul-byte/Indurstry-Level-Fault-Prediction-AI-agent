import React from "react";

interface FieldErrorProps {
  message?: string;
}

export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p className="mt-1 text-sm text-red-500 font-medium animate-pulse">
      {message}
    </p>
  );
}
