"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NativeSelect } from "@/components/ui/native-select";
import { mergeNigerianAndExamSubjects, mergeUniqueSubjects } from "@/data/subjects";

type ExamOption = {
  id: string;
  slug: string;
  name: string;
  subjects: string[];
};

type Turn = { role: "user" | "assistant"; content: string };
type ThreadSummary = {
  id: string;
  title: string;
  last_message_at?: string | null;
};

function examSubjects(exam: ExamOption | undefined) {
  if (!exam) return [];
  if (exam.slug === "waec" || exam.slug === "neco" || exam.slug === "jamb") {
    return mergeNigerianAndExamSubjects(exam.subjects);
  }
  return mergeUniqueSubjects(exam.subjects);
}

export function TutorChat(props: { exams: ExamOption[] }) {
  const initialExam = props.exams[0];
  const [examId, setExamId] = React.useState(initialExam?.id ?? "");
  const [subject, setSubject] = React.useState(examSubjects(initialExam)[0] ?? "");
  const [language, setLanguage] = React.useState<"en" | "pidgin" | "hausa" | "yoruba" | "igbo">("en");
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [threads, setThreads] = React.useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = React.useState<string>("");
  const [loadingThreads, setLoadingThreads] = React.useState(false);
  const [loadingThread, setLoadingThread] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([
    {
      role: "assistant",
      content: "Tell me what you're stuck on. I'll explain and give you a quick practice question."
    }
  ]);

  const exam = React.useMemo(() => props.exams.find((item) => item.id === examId), [props.exams, examId]);
  const subjects = React.useMemo(() => examSubjects(exam), [exam]);

  React.useEffect(() => {
    if (!subjects.length) return;
    if (!subjects.includes(subject)) setSubject(subjects[0] ?? "");
  }, [subjects, subject]);

  React.useEffect(() => {
    let mounted = true;
    async function loadThreads() {
      if (!examId || !subject) return;
      setLoadingThreads(true);
      try {
        const res = await fetch(`/api/ai/tutor/threads?exam_id=${encodeURIComponent(examId)}&subject=${encodeURIComponent(subject)}`);
        const json = await res.json();
        if (!mounted) return;
        if (json?.ok) {
          setThreads((json.threads ?? []).map((t: any) => ({
            id: String(t.id ?? ""),
            title: String(t.title ?? "Conversation"),
            last_message_at: t.last_message_at ?? null
          })));
        }
      } catch {
        if (mounted) setThreads([]);
      } finally {
        if (mounted) setLoadingThreads(false);
      }
    }

    setActiveThreadId("");
    setTurns([
      {
        role: "assistant",
        content: "Tell me what you're stuck on. I'll explain and give you a quick practice question."
      }
    ]);
    loadThreads();

    return () => {
      mounted = false;
    };
  }, [examId, subject]);

  async function openThread(threadId: string) {
    if (!threadId) return;
    setActiveThreadId(threadId);
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/ai/tutor/threads/${threadId}`);
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.message ?? "Failed to load thread.");
      const next = (json.messages ?? []).map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? "")
      }));
      setTurns(next.length ? next : turns);
    } catch (e: any) {
      toast.error(e?.message ?? "Unable to load conversation.");
    } finally {
      setLoadingThread(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          exam: exam?.name ?? "",
          exam_id: exam?.id ?? "",
          subject,
          thread_id: activeThreadId || undefined
        })
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.message ?? "Tutor failed.");
      if (json.thread_id && !activeThreadId) {
        setActiveThreadId(String(json.thread_id));
      }
      setTurns((t) => [...t, { role: "assistant", content: String(json.answer ?? "") }]);
      if (json.thread_id) {
        const resThreads = await fetch(`/api/ai/tutor/threads?exam_id=${encodeURIComponent(exam?.id ?? "")}&subject=${encodeURIComponent(subject)}`);
        const threadsJson = await resThreads.json();
        if (threadsJson?.ok) {
          setThreads((threadsJson.threads ?? []).map((t: any) => ({
            id: String(t.id ?? ""),
            title: String(t.title ?? "Conversation"),
            last_message_at: t.last_message_at ?? null
          })));
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Tutor error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Exam</div>
          <NativeSelect value={examId} onChange={(e) => setExamId(e.target.value)}>
            {props.exams.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Subject</div>
          <NativeSelect value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!subjects.length}>
            {subjects.length ? null : <option value="">Select exam first</option>}
            {subjects.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Language</div>
          <NativeSelect value={language} onChange={(e) => setLanguage(e.target.value as any)}>
            <option value="en">English</option>
            <option value="pidgin">Pidgin</option>
            <option value="hausa">Hausa</option>
            <option value="yoruba">Yoruba</option>
            <option value="igbo">Igbo</option>
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
        <Card className="h-[52vh] overflow-hidden sm:h-[55vh]">
          <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
            <span>History</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setActiveThreadId("");
                setTurns([
                  {
                    role: "assistant",
                    content: "Tell me what you're stuck on. I'll explain and give you a quick practice question."
                  }
                ]);
              }}
            >
              New
            </Button>
          </div>
          <ScrollArea className="h-[calc(52vh-36px)] sm:h-[calc(55vh-36px)]">
            <div className="p-2">
              {loadingThreads ? (
                <div className="text-xs text-muted-foreground">Loading...</div>
              ) : threads.length ? (
                threads.map((thread) => (
                  <button
                    type="button"
                    key={thread.id}
                    onClick={() => openThread(thread.id)}
                    className={[
                      "w-full rounded-lg border px-2 py-2 text-left text-xs transition",
                      activeThreadId === thread.id ? "border-primary/60 bg-primary/10" : "border-border/60"
                    ].join(" ")}
                  >
                    <div className="truncate font-medium">{thread.title}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {thread.last_message_at ? new Date(thread.last_message_at).toLocaleDateString() : "No date"}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No saved conversations yet.</div>
              )}
            </div>
          </ScrollArea>
        </Card>

        <ScrollArea className="h-[52vh] rounded-xl border bg-card p-3 sm:h-[55vh] sm:p-4">
          <div className="space-y-3">
            {loadingThread ? <div className="text-xs text-muted-foreground">Loading conversation...</div> : null}
            {turns.map((t, idx) => (
              <Card
                key={idx}
                className={[
                  "p-3 text-sm",
                  t.role === "assistant" ? "border-border bg-background" : "border-primary/30 bg-primary/10"
                ].join(" ")}
              >
                <div className="mb-1 text-xs text-muted-foreground">{t.role === "assistant" ? "Tutor" : "You"}</div>
                <div className="whitespace-pre-wrap">{t.content}</div>
                {t.role === "assistant" && language !== "en" ? (
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/ai/translate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ text: t.content, language })
                          });
                          const json = await res.json();
                          if (!json?.ok) throw new Error(json?.message ?? "Translate failed.");
                          setTurns((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, content: String(json.text ?? x.content) } : x))
                          );
                        } catch (e: any) {
                          toast.error(e?.message ?? "Translate error.");
                        }
                      }}
                    >
                      Translate to {language}
                    </Button>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <Button onClick={send} disabled={loading}>
          {loading ? "Thinking..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
