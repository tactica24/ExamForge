import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthCard(props: {
  title: string;
  description: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/20">
      <div className="container flex min-h-dvh items-center justify-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{props.title}</CardTitle>
            <CardDescription>{props.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {props.children}
            <div className="pt-2 text-center text-xs text-muted-foreground">
              <Link className="hover:text-foreground" href="/">
                ← Back to home
              </Link>
            </div>
            <div className="border-t pt-4">{props.footer}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

