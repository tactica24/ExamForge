"use client";

import * as React from "react";
import { toast } from "sonner";
import { dequeueSyncedQuizSubmissions, loadQuizQueue } from "@/lib/offline/quiz-queue";

export function OfflineSync() {
  React.useEffect(() => {
    let timer: any;

    async function sync() {
      const items = loadQuizQueue();
      if (!items.length) return;
      if (!navigator.onLine) return;

      try {
        const res = await fetch("/api/quizzes/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((i) => ({ quizId: i.quizId, answers: i.answers }))
          })
        });
        const json = await res.json();
        if (!json?.ok) return;

        const syncedIds = (json.results ?? [])
          .filter((r: any) => r.ok)
          .map((r: any) => String(r.quizId));

        if (syncedIds.length) {
          dequeueSyncedQuizSubmissions(syncedIds);
          toast.success(`Synced ${syncedIds.length} offline quiz result(s).`);
        }
      } catch {
        // ignore
      }
    }

    const onOnline = () => sync();
    window.addEventListener("online", onOnline);

    timer = setInterval(sync, 15000);
    sync();

    return () => {
      window.removeEventListener("online", onOnline);
      if (timer) clearInterval(timer);
    };
  }, []);

  return null;
}

