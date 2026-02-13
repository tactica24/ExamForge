"use client";

import * as React from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function OAuthButtons() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  async function start(provider: "google") {
    try {
      const redirectTo = `${window.location.origin}/onboarding`;
      const { error } = await supabase.auth.signInWithOAuth({
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
