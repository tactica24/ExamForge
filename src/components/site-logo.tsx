import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-foreground", className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 4.5h10a2 2 0 0 1 2 2v10.2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M8.5 8h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.5 11h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.5 14h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M14.5 14.5 16 16l3-3"
        stroke="#22c55e"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

