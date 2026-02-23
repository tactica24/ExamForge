import Link from "next/link";
import { Logo } from "@/components/site-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-gradient-to-r from-background/90 via-background/85 to-primary/10 backdrop-blur-md">
      <div className="container flex min-h-16 flex-col items-start justify-between gap-3 py-3 sm:flex-row sm:items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/25">
            <Logo className="h-5 w-5 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-sm font-semibold tracking-tight">ACE NAIJA</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Exam prep</div>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </nav>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <div className="hidden sm:flex">
            <ThemeToggle />
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

