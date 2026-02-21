"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const TOPIC_OPTIONS = [
  "Payment challenges",
  "Account access",
  "Content or syllabus",
  "Group study",
  "Pricing and plans",
  "Other"
];

type FormState = "idle" | "sending" | "success" | "error";

export function ContactRevealCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<FormState>("idle");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      topic: String(formData.get("topic") ?? ""),
      message: String(formData.get("message") ?? "")
    };

    try {
      const response = await fetch("/api/marketing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("contact_request_failed");
      setState("success");
      form.reset();
    } catch {
      setState("error");
    }
  };

  return (
    <Card className="relative overflow-hidden border-primary/20 p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative">
        <Badge className="mb-3 rounded-full">Contact us</Badge>
        <h3 className="text-lg font-semibold">Need help or clarity?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your question and we will respond quickly.
        </p>
        {!isOpen ? (
          <Button className="mt-5 w-full" onClick={() => setIsOpen(true)}>
            Send a message
          </Button>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input id="contact-name" name="name" placeholder="Your full name" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input id="contact-email" name="email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-topic">Topic</Label>
                <NativeSelect id="contact-topic" name="topic" defaultValue={TOPIC_OPTIONS[0]} required>
                  {TOPIC_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  name="message"
                  rows={4}
                  placeholder="Tell us what you need help with."
                  required
                />
              </div>
            </div>
            {state === "success" ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Message sent. We will get back to you shortly.
              </p>
            ) : state === "error" ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                Something went wrong. Please try again.
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={state === "sending"}>
              {state === "sending" ? "Sending..." : "Send message"}
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
