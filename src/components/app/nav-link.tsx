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
        "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground"
      )}
    >
      {props.label}
    </Link>
  );
}

