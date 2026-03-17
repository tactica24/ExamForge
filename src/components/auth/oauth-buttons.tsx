"use client";

import * as React from "react";
import { toast } from "sonner";
import { sanitizeNextPath } from "@/lib/auth/redirects";
import { createFirebaseBrowserClient } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

export function OAuthButtons(props: { nextPath?: string | null }) {
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
      const nextPath = sanitizeNextPath(props.nextPath) ?? "/dashboard";
      const redirectTo = `${window.location.origin}${nextPath}`;
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
