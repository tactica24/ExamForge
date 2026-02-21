import Link from "next/link";
import { Logo } from "@/components/site-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthCard(props: {
  title: string;
  description: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-background via-background to-muted/25">
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="container flex min-h-dvh items-center justify-center py-12">
        <Card className="w-full max-w-md border-border/70">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/25">
                <Logo className="h-5 w-5 text-primary" />
              </div>
              <div className="leading-tight">
                <div className="font-display text-sm font-semibold tracking-tight">ACE NAIJA</div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Exam prep</div>
              </div>
            </div>
            <CardTitle>{props.title}</CardTitle>
            <CardDescription>{props.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {props.children}
            <div className="pt-2 text-center text-xs text-muted-foreground">
              <Link className="hover:text-foreground" href="/">
                {"<-"} Back to home
              </Link>
            </div>
            <div className="border-t border-border/60 pt-4">{props.footer}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
