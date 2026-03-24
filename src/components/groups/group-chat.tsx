"use client";

import * as React from "react";
import { toast } from "sonner";
import { createFirebaseBrowserClient } from "@/lib/firebase/client";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sendGroupMessageAction } from "@/app/(app)/groups/actions";

type Message = {
  id: string;
  user_id: string | null;
  content: string;
  flagged: boolean;
  is_system?: boolean;
  created_at: string;
  author_name?: string | null;
};

export function GroupChat(props: {
  groupId: string;
  currentUserId: string;
  initialMessages: Message[];
}) {
  const firebase = React.useMemo(() => createFirebaseBrowserClient(), []);
  const [messages, setMessages] = React.useState<Message[]>(props.initialMessages);
  const [draft, setDraft] = React.useState("");

  const upsertMessage = React.useCallback((nextMessage: Message) => {
    setMessages((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.id === nextMessage.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          ...nextMessage
        };
        return next;
      }
      return [nextMessage, ...prev];
    });
  }, []);

  React.useEffect(() => {
    const channel = firebase
      .channel(`group:${props.groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${props.groupId}` },
        (payload) => {
          const message = payload.new as any;
          upsertMessage({ ...message } as Message);
        }
      )
      .subscribe();

    return () => {
      firebase.removeChannel(channel);
    };
  }, [firebase, props.groupId, upsertMessage]);

  return (
    <div className="grid gap-3 p-4">
      <ScrollArea className="h-[52vh] bg-[linear-gradient(180deg,rgba(15,23,42,0.03),rgba(15,23,42,0.01))] p-4">
        <div className="flex flex-col-reverse gap-3">
          {messages.map((message) => {
            const mine = message.user_id === props.currentUserId;
            const system = Boolean(message.is_system) || message.user_id === null;

            return (
              <div
                key={message.id}
                className={[
                  "max-w-[85%] rounded-2xl border px-3 py-2 text-sm shadow-sm",
                  system
                    ? "mx-auto border-dashed bg-muted/50"
                    : mine
                      ? "ml-auto border-primary/20 bg-primary/10"
                      : "bg-background"
                ].join(" ")}
              >
                <div className="mb-1 text-xs text-muted-foreground">
                  {system ? "ACE NAIJA" : mine ? "You" : message.author_name ?? "Member"} |{" "}
                  {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {message.flagged ? " | flagged" : ""}
                </div>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            );
          })}
          {!messages.length ? (
            <div className="rounded-xl border border-dashed bg-card/70 px-4 py-6 text-center text-sm text-muted-foreground">
              No messages yet. Say hello to your group.
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <AuthFormState
        action={async (prev, formData) => {
          const result: any = await sendGroupMessageAction(prev, formData);
          if (!result?.ok) {
            toast.error(result?.message ?? "Could not send.");
            return result;
          }

          if (result?.messageRecord) {
            upsertMessage(result.messageRecord as Message);
          }
          setDraft("");
          return result;
        }}
      >
        <input type="hidden" name="group_id" value={props.groupId} />
        <div className="flex gap-2">
          <Input
            name="content"
            placeholder="Type a message..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            required
          />
          <SubmitButton type="submit" pendingText="Sending...">
            Send
          </SubmitButton>
        </div>
      </AuthFormState>
    </div>
  );
}
