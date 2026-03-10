import Link from "next/link";
import { BrandBadge } from "@/components/branding/brand-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-gradient-to-r from-background/92 via-background/86 to-cyan-200/22 backdrop-blur-md dark:to-cyan-900/22">
      <div className="container flex min-h-16 flex-col items-start justify-between gap-3 py-3 sm:flex-row sm:items-center">
        <BrandBadge href="/" subtitle="Exam prep" />
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

