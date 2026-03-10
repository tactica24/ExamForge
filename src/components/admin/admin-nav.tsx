"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpenCheck,
  LayoutDashboard,
  Megaphone,
  MessageSquareWarning,
  Users,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  exams: BookOpenCheck,
  users: Users,
  support: MessageSquareWarning,
  referrals: Megaphone,
  ops: Activity
};

const ITEMS = [
  { href: "/admin", label: "Overview", description: "Control room", icon: "overview" },
  { href: "/admin/exams", label: "Exams", description: "Content and syllabus", icon: "exams" },
  { href: "/admin/users", label: "Users", description: "Access and support", icon: "users" },
  { href: "/admin/support", label: "Support", description: "Pending and resolved issues", icon: "support" },
  { href: "/admin/referrals", label: "Referrals", description: "Campaign performance", icon: "referrals" },
  { href: "/admin/ops", label: "Ops", description: "Queues and reliability", icon: "ops" }
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="grid gap-2 md:grid-cols-6">
      {ITEMS.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-left transition-all hover:border-primary/40 hover:bg-primary/10",
              active && "border-primary/45 bg-primary/12 shadow-[0_14px_36px_-24px_hsl(var(--primary)/0.7)]"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 rounded-xl bg-primary/10 p-2 text-primary transition-colors group-hover:bg-primary/15",
                  active && "bg-primary/20"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-tight text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
