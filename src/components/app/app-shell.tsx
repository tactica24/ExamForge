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
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-background via-background to-muted/20">
      <div className="pointer-events-none absolute -left-24 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-24 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <Logo className="h-5 w-5 text-primary" />
              </div>
              <span className="font-display text-sm font-semibold tracking-tight">{brandLabel}</span>
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
      <main className="container page-enter pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6 sm:pb-8 sm:pt-8">
        {props.children}
      </main>
    </div>
  );
}

