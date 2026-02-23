import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-gradient-to-r from-background/92 via-background/86 to-cyan-200/22 backdrop-blur-sm dark:to-cyan-900/22">
      <div className="container flex flex-col gap-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          (c) {new Date().getFullYear()} ACE NAIJA. Not affiliated with any exam body.
        </div>
        <div className="flex flex-wrap gap-6 text-xs font-medium text-muted-foreground">
          <Link className="hover:text-foreground" href="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-foreground" href="/terms">
            Terms
          </Link>
          <Link className="hover:text-foreground" href="/pricing">
            Pricing
          </Link>
        </div>
      </div>
    </footer>
  );
}
