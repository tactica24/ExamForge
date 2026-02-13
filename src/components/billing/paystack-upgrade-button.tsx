"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PaystackUpgradeButton() {
  const [loading, setLoading] = React.useState(false);

  return (
    <Button
      onClick={async () => {
        try {
          setLoading(true);
          const res = await fetch("/api/billing/paystack/init", { method: "POST" });
          const json = await res.json();
          if (!json?.ok) throw new Error(json?.message ?? "Could not start checkout.");
          window.location.href = json.url;
        } catch (e: any) {
          toast.error(e?.message ?? "Checkout failed.");
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
    >
      {loading ? "Redirecting..." : "Upgrade with Paystack"}
    </Button>
  );
}
