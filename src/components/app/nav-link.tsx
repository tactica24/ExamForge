"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink(props: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === props.href || pathname.startsWith(`${props.href}/`);
  return (
    <Link
      href={props.href}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-accent/80 hover:text-foreground",
        active && "bg-primary/15 text-foreground ring-1 ring-primary/30"
      )}
    >
      {props.label}
    </Link>
  );
}

