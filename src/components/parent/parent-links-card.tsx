"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ParentLink = { token: string; label: string | null; created_at: string };

export function ParentLinksCard(props: { links: ParentLink[] }) {
  const base = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Parent view</CardTitle>
        <CardDescription>Create a read-only link to share progress with a parent/guardian.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.links.length ? (
          props.links.map((l) => {
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
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-sm text-muted-foreground">No parent links yet.</div>
        )}
        <p className="text-xs text-muted-foreground">
          Parent view uses a secure token. Revoke links in Firebase (MVP: revoke UI coming next).
        </p>
      </CardContent>
    </Card>
  );
}

