"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, BellDot, BookOpenCheck, CreditCard, LifeBuoy, LogOut, Megaphone, Settings, Shield, User, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function UserMenu(props: { name: string | null; avatarUrl?: string | null; isAdmin: boolean }) {
  const [signingOut, setSigningOut] = useState(false);
  const initials =
    props.name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase())
      .join("") ?? "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 rounded-full border border-transparent px-2.5 hover:border-border/70 hover:bg-muted/70 data-[state=open]:border-border/70 data-[state=open]:bg-muted/70"
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={props.avatarUrl ?? undefined} alt={props.name ?? "User avatar"} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm sm:inline">{props.name ?? "Account"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="py-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Signed in as</div>
          <div className="mt-1 text-sm font-semibold text-foreground">{props.name ?? "Account"}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {props.isAdmin ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin" className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Admin overview
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/exams" className="flex items-center gap-2">
                <BookOpenCheck className="h-4 w-4" /> Exams and syllabus
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/users" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Users and roles
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/referrals" className="flex items-center gap-2">
                <Megaphone className="h-4 w-4" /> Referral campaigns
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/ops" className="flex items-center gap-2">
                <Activity className="h-4 w-4" /> Ops and reliability
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2">
                <User className="h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/notifications" className="flex items-center gap-2">
                <BellDot className="h-4 w-4" /> Notifications
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/support" className="flex items-center gap-2">
                <LifeBuoy className="h-4 w-4" /> Contact support
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Billing
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={async (e) => {
            e.preventDefault();
            if (signingOut) return;

            try {
              setSigningOut(true);
              const response = await fetch("/logout", {
                method: "POST",
                headers: {
                  Accept: "text/html,application/xhtml+xml"
                },
                credentials: "same-origin"
              });

              if (response.redirected) {
                window.location.assign(response.url);
                return;
              }

              if (response.ok) {
                window.location.assign("/");
                return;
              }
            } catch {
              // Fall back to the hidden form submit below.
            }

            const form = document.getElementById("logout-form") as HTMLFormElement | null;
            if (!form) {
              window.location.assign("/");
              return;
            }
            if (typeof (form as any).requestSubmit === "function") (form as any).requestSubmit();
            else form.submit();
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" /> {signingOut ? "Logging out..." : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

