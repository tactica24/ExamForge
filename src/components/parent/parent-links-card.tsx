"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ParentLink = { token: string; label: string | null; created_at: string; revoked_at?: string | null };

export function ParentLinksCard(props: { links: ParentLink[] }) {
  const [links, setLinks] = React.useState<ParentLink[]>(props.links);
  const [revoking, setRevoking] = React.useState<string | null>(null);
  const base = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Parent view</CardTitle>
        <CardDescription>Create a read-only link to share progress with a parent/guardian.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {links.length ? (
          links.map((l) => {
            const url = `${base}/p/${l.token}`;
            return (
              <div key={l.token} className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="space-y-1">
                  <div className="text-sm font-medium">{l.label ?? "Progress link"}</div>
                  <Input value={url} readOnly />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={revoking === l.token}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Copied parent link.");
                      } catch {
                        toast.error("Could not copy.");
                      }
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={revoking === l.token}
                    onClick={async () => {
                      try {
                        setRevoking(l.token);
                        const res = await fetch("/api/parent-links/revoke", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ token: l.token })
                        });
                        const json = await res.json().catch(() => null);
                        if (!res.ok || !json?.ok) {
                          throw new Error(json?.message ?? "Could not revoke link.");
                        }

                        setLinks((prev) => prev.filter((item) => item.token !== l.token));
                        toast.success("Parent link revoked.");
                      } catch (error: any) {
                        toast.error(error?.message ?? "Could not revoke link.");
                      } finally {
                        setRevoking(null);
                      }
                    }}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-sm text-muted-foreground">No parent links yet.</div>
        )}
        <p className="text-xs text-muted-foreground">
          Parent view uses a secure token. Revoke links any time from this page.
        </p>
      </CardContent>
    </Card>
  );
}

