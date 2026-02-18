"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NativeSelect } from "@/components/ui/native-select";

type ExamOption = {
  id: string;
  slug: string;
  name: string;
  subjects: string[];
};

type Turn = { role: "user" | "assistant"; content: string };

export function TutorChat(props: { exams: ExamOption[] }) {
  const initialExam = props.exams[0];
  const [examId, setExamId] = React.useState(initialExam?.id ?? "");
  const [subject, setSubject] = React.useState(initialExam?.subjects?.[0] ?? "");
  const [language, setLanguage] = React.useState<"en" | "pidgin" | "hausa" | "yoruba" | "igbo">("en");
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([
    {
      role: "assistant",
      content: "Tell me what you’re stuck on. I’ll explain and give you a quick practice question."
    }
  ]);

  const exam = React.useMemo(() => props.exams.find((item) => item.id === examId), [props.exams, examId]);
  const subjects = React.useMemo(() => exam?.subjects ?? [], [exam]);

  React.useEffect(() => {
    if (!subjects.length) return;
    if (!subjects.includes(subject)) setSubject(subjects[0] ?? "");
  }, [subjects, subject]);

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
        body: JSON.stringify({ message: text, exam: exam?.name ?? "", exam_id: exam?.id ?? "", subject })
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.message ?? "Tutor failed.");
      setTurns((t) => [...t, { role: "assistant", content: String(json.answer ?? "") }]);
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

      <ScrollArea className="h-[55vh] rounded-xl border bg-card p-4">
        <div className="space-y-3">
          {turns.map((t, idx) => (
            <Card
              key={idx}
              className={[
                "p-3 text-sm",
                t.role === "assistant" ? "border-border bg-background" : "border-primary/30 bg-primary/10"
              ].join(" ")}
            >
              <div className="mb-1 text-xs text-muted-foreground">
                {t.role === "assistant" ? "Tutor" : "You"}
              </div>
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
                        setTurns((prev) => prev.map((x, i) => (i === idx ? { ...x, content: String(json.text ?? x.content) } : x)));
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
