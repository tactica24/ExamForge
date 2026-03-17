"use client";

import * as React from "react";
import { toast } from "sonner";
import { createFirebaseBrowserClient } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

export function OAuthButtons() {
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const firebase = createFirebaseBrowserClient();
      const result = await firebase.auth.completeOAuthRedirect();
      if (!mounted || !result?.handled) return;

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      if (result.redirectTo) {
        window.location.assign(result.redirectTo);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function start(provider: "google") {
    try {
      const firebase = createFirebaseBrowserClient();
      const redirectTo = `${window.location.origin}/dashboard`;
      const { error } = await firebase.auth.signInWithOAuth({
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
