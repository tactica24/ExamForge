"use client";

import * as React from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sendGroupMessageAction } from "@/app/(app)/groups/actions";

type Message = {
  id: string;
  user_id: string;
  content: string;
  flagged: boolean;
  created_at: string;
  author_name?: string | null;
};

export function GroupChat(props: {
  groupId: string;
  currentUserId: string;
  initialMessages: Message[];
}) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [messages, setMessages] = React.useState<Message[]>(props.initialMessages);

  React.useEffect(() => {
    const channel = supabase
      .channel(`group:${props.groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${props.groupId}` },
        (payload) => {
          const m = payload.new as any;
          setMessages((prev) => [{ ...m }, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, props.groupId]);

  return (
    <div className="grid gap-3">
      <ScrollArea className="h-[55vh] rounded-xl border bg-card p-4">
        <div className="flex flex-col-reverse gap-3">
          {messages.map((m) => {
            const mine = m.user_id === props.currentUserId;
            return (
              <div
                key={m.id}
                className={[
                  "max-w-[85%] rounded-xl border px-3 py-2 text-sm",
                  mine ? "ml-auto bg-primary/10" : "bg-background"
                ].join(" ")}
              >
                <div className="mb-1 text-xs text-muted-foreground">
                  {mine ? "You" : m.author_name ?? "Member"} ·{" "}
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {m.flagged ? " · flagged" : ""}
                </div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            );
          })}
          {!messages.length ? <div className="text-sm text-muted-foreground">No messages yet.</div> : null}
        </div>
      </ScrollArea>

      <AuthFormState
        action={async (prev, formData) => {
          const res: any = await sendGroupMessageAction(prev, formData);
          if (!res?.ok) toast.error(res?.message ?? "Could not send.");
          return res;
        }}
      >
        <input type="hidden" name="group_id" value={props.groupId} />
        <div className="flex gap-2">
          <Input name="content" placeholder="Message your group…" required />
          <SubmitButton type="submit" pendingText="Sending…">
            Send
          </SubmitButton>
        </div>
      </AuthFormState>
    </div>
  );
}

