import { NavLink } from "@/components/app/nav-link";
import { UserMenu } from "@/components/app/user-menu";
import { Logo } from "@/components/site-logo";

export function AppShell(props: {
  name: string | null;
  avatarUrl?: string | null;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const navItems = props.isAdmin
    ? [
        { href: "/admin", label: "Overview" },
        { href: "/admin/exams", label: "Exams" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/referrals", label: "Referrals" },
        { href: "/admin/ops", label: "Ops" }
      ]
    : [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/plan", label: "Plan" },
        { href: "/groups", label: "Groups" },
        { href: "/tutor", label: "Tutor" },
        { href: "/progress", label: "Progress" },
        { href: "/leaderboard", label: "Leaderboard" },
        { href: "/mock-exam", label: "Mock" }
      ];

  const brandLabel = props.isAdmin ? "ACE NAIJA Admin" : "ACE NAIJA";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-background via-background to-muted/45">
      <div className="pointer-events-none absolute -left-36 -top-24 h-72 w-72 rounded-full bg-primary/28 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 top-20 h-80 w-80 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-700/30" />
      <div className="pointer-events-none absolute left-1/4 top-[60%] h-72 w-72 rounded-full bg-amber-300/26 blur-3xl dark:bg-amber-700/18" />
      <header className="sticky top-0 z-40 border-b border-border/70 bg-gradient-to-r from-background/92 via-background/86 to-cyan-200/22 backdrop-blur-md dark:to-cyan-900/22">
        <div className="container flex min-h-16 items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/25">
                <Logo className="h-5 w-5 text-primary" />
              </div>
              <div className="leading-tight">
                <div className="font-display text-sm font-semibold tracking-tight">{brandLabel}</div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Workspace</div>
              </div>
            </div>
            <nav className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <form id="logout-form" action="/logout" method="post" className="hidden" />
            <UserMenu name={props.name} avatarUrl={props.avatarUrl} isAdmin={props.isAdmin} />
          </div>
        </div>
        <div className="container pb-3 sm:hidden">
          <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
        </div>
      </header>
      <main className="container page-enter pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 sm:pb-10 sm:pt-10">
        {props.children}
      </main>
    </div>
  );
}

