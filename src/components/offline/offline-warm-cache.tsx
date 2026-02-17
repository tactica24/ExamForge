"use client";

import * as React from "react";

const KEY = "ace-naija.offline.snapshot.v1";

export function OfflineWarmCache(props: { lowDataMode: boolean }) {
  React.useEffect(() => {
    if (props.lowDataMode) return;
    (async () => {
      try {
        const res = await fetch("/api/offline/snapshot", { cache: "no-store" });
        const json = await res.json();
        if (json?.ok) localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), ...json }));
      } catch {
        // ignore
      }
    })();
  }, [props.lowDataMode]);

  return null;
}

