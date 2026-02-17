"use client";

import * as React from "react";
import { toast } from "sonner";
import { createFirebaseBrowserClient } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

export function OAuthButtons() {
  async function start(provider: "google") {
    try {
      const firebase = createFirebaseBrowserClient();
      const redirectTo = `${window.location.origin}/onboarding`;
      const { error } = await firebase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo
        }
      });
      if (error) throw error;
    } catch (e: any) {
      toast.error(e?.message ?? "OAuth failed.");
    }
  }

  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" onClick={() => start("google")}>
        Continue with Google
      </Button>
    </div>
  );
}
