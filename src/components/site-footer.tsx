import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} ExamForge. Not affiliated with any exam body.
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
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
