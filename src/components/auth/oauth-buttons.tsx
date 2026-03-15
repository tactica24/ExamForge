"use client";

import * as React from "react";
import { toast } from "sonner";
import { createFirebaseBrowserClient } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

function isFirebaseWebAuthConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

export function OAuthButtons() {
  const oauthReady = isFirebaseWebAuthConfigured();

  React.useEffect(() => {
    if (!oauthReady) return;
    let mounted = true;

    (async () => {
      try {
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
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "Google sign-in is not available right now.";
        toast.error(message);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [oauthReady]);

  async function start(provider: "google") {
    if (!oauthReady) {
      toast.error("Google sign-in is not configured yet. Use email and password for now.");
      return;
    }

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
      toast.error(e?.message ?? "Google sign-in failed.");
    }
  }

  if (!oauthReady) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" onClick={() => start("google")}>
        Continue with Google
      </Button>
    </div>
  );
}
