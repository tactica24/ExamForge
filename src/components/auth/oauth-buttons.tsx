"use client";

import * as React from "react";
import { toast } from "sonner";
import { createBackendBrowserClient } from "@/lib/backend/client";
import { Button } from "@/components/ui/button";

export function OAuthButtons() {
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const backend = createBackendBrowserClient();
      const result = await backend.auth.completeOAuthRedirect();
      if (!mounted || !result?.handled) return;

      if (result.error) {
        toast.error(result.error.message);
        return;
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function start(provider: "google") {
    try {
      const backend = createBackendBrowserClient();
      const redirectTo = `${window.location.origin}/onboarding`;
      const { error } = await backend.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo
        }
      });
      if (error) throw error;
    } catch (e: any) {
      toast.error(e?.message ?? "Google sign-in failed.");
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
