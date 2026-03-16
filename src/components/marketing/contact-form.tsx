"use client";

import { useMemo, useState } from "react";
import { MessageCircle, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORT_WHATSAPP_LABEL, SUPPORT_WHATSAPP_URL } from "@/lib/contact/requests";

const GENERAL_TOPICS = [
  "Payment challenges",
  "Account access",
  "Content or syllabus",
  "Group study",
  "Pricing and plans",
  "Other"
];

const ENTERPRISE_TOPICS = [
  "School onboarding",
  "Cohort rollout",
  "Custom reporting",
  "WhatsApp or SMS support",
  "Pricing discussion",
  "Other"
];

type FormState = "idle" | "sending" | "success" | "error";

export function MarketingContactForm(props: {
  defaultSource?: string;
  defaultTopic?: string;
  enterprise?: boolean;
  compact?: boolean;
}) {
  const [state, setState] = useState<FormState>("idle");
  const topics = useMemo(
    () => (props.enterprise ? ENTERPRISE_TOPICS : GENERAL_TOPICS),
    [props.enterprise]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      organization: String(formData.get("organization") ?? ""),
      topic: String(formData.get("topic") ?? ""),
      source: String(formData.get("source") ?? props.defaultSource ?? (props.enterprise ? "enterprise" : "homepage")),
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
    <form className="space-y-4" onSubmit={handleSubmit}>
      <input type="hidden" name="source" value={props.defaultSource ?? (props.enterprise ? "enterprise" : "homepage")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="contact-name">Name</Label>
          <Input id="contact-name" name="name" placeholder="Your full name" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" name="email" type="email" placeholder="you@example.com" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact-phone">Phone number</Label>
          <Input id="contact-phone" name="phone" placeholder="+234..." />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact-topic">Topic</Label>
          <NativeSelect
            id="contact-topic"
            name="topic"
            defaultValue={props.defaultTopic ?? topics[0]}
            required
          >
            {topics.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
        </div>
        {props.enterprise ? (
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="contact-organization">School or organization</Label>
            <Input id="contact-organization" name="organization" placeholder="School name, cohort, or company" />
          </div>
        ) : null}
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="contact-message">{props.enterprise ? "What do you need?" : "Message"}</Label>
          <Textarea
            id="contact-message"
            name="message"
            rows={props.compact ? 4 : 6}
            placeholder={
              props.enterprise
                ? "Tell us what you want us to help you launch, improve, or support."
                : "Tell us what you need help with."
            }
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="flex-1" disabled={state === "sending"}>
          {state === "sending" ? "Sending..." : "Send message"}
        </Button>
        <Button asChild type="button" variant="outline" className="flex-1">
          <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp us
          </a>
        </Button>
      </div>

      <Card className="border-primary/15 bg-primary/5 p-4">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <PhoneCall className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <div className="font-medium text-foreground">Need a faster response?</div>
            <div className="mt-1">
              Reach us on WhatsApp at <Badge variant="secondary" className="ml-1 rounded-full">{SUPPORT_WHATSAPP_LABEL}</Badge>
            </div>
          </div>
        </div>
      </Card>
    </form>
  );
}
