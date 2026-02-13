import { NavLink } from "@/components/app/nav-link";
import { UserMenu } from "@/components/app/user-menu";
import { Logo } from "@/components/site-logo";

export function AppShell(props: {
  name: string | null;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/15">
      <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Logo className="h-6 w-6" />
              <span className="text-sm font-semibold tracking-tight">ExamForge</span>
            </div>
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink href="/dashboard" label="Dashboard" />
              <NavLink href="/plan" label="Plan" />
              <NavLink href="/groups" label="Groups" />
              <NavLink href="/tutor" label="Tutor" />
              <NavLink href="/progress" label="Progress" />
              <NavLink href="/leaderboard" label="Leaderboard" />
              <NavLink href="/mock-exam" label="Mock" />
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <form id="logout-form" action="/logout" method="post" className="hidden" />
            <UserMenu name={props.name} isAdmin={props.isAdmin} />
          </div>
        </div>
        <div className="container pb-3 sm:hidden">
          <nav className="flex flex-wrap gap-2">
            <NavLink href="/dashboard" label="Dashboard" />
            <NavLink href="/plan" label="Plan" />
            <NavLink href="/groups" label="Groups" />
            <NavLink href="/tutor" label="Tutor" />
            <NavLink href="/progress" label="Progress" />
            <NavLink href="/leaderboard" label="Leaderboard" />
            <NavLink href="/mock-exam" label="Mock" />
          </nav>
        </div>
      </header>
      <main className="container py-8">{props.children}</main>
    </div>
  );
}
