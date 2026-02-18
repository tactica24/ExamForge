import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={cn(className)}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="exam-forge-logo" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0D4A6A" />
          <stop offset="1" stopColor="#1CA3A3" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#exam-forge-logo)" />
      <rect x="14.5" y="17" width="35" height="30" rx="6" fill="#F7FBFF" fillOpacity="0.95" />
      <path d="M22 24H42" stroke="#0E3A50" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M22 31H36" stroke="#0E3A50" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M22 38H42" stroke="#0E3A50" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M40 26L45.5 31.5L40 37" stroke="#14B8A6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
