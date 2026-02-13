"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReferralCard() {
  const [code, setCode] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/referrals/code");
        const json = await res.json();
        if (mounted && json?.ok) setCode(String(json.code ?? ""));
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const url = code ? `${window.location.origin}/r/${code}` : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Referral</CardTitle>
        <CardDescription>Invite friends. When they onboard, you both get a 7-day Pro trial.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={loading ? "Loading..." : url} readOnly />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!url}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Copied referral link.");
              } catch {
                toast.error("Could not copy.");
              }
            }}
          >
            Copy link
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: share on WhatsApp and ask your friend to complete onboarding after signup.
        </p>
      </CardContent>
    </Card>
  );
}

