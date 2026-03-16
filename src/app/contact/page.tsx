import { MessageCircle, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MarketingContactForm } from "@/components/marketing/contact-form";
import { SUPPORT_WHATSAPP_LABEL, SUPPORT_WHATSAPP_URL } from "@/lib/contact/requests";

export default async function ContactPage(props: { searchParams: Promise<{ intent?: string }> }) {
  const searchParams = await props.searchParams;
  const enterprise = String(searchParams.intent ?? "").trim().toLowerCase() === "enterprise";

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/25">
      <SiteHeader />
      <main className="container page-enter pb-16 pt-12">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="relative overflow-hidden border-primary/20 p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/12 blur-2xl" />
            <div className="relative">
              <Badge variant="secondary" className="rounded-full">
                {enterprise ? "Enterprise contact" : "Contact us"}
              </Badge>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {enterprise ? "Tell us what your school or team needs" : "Get help quickly and cleanly"}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                {enterprise
                  ? "Share your rollout plan, reporting needs, support expectations, or WhatsApp workflow questions. The message will appear in the admin support queue as an enterprise enquiry."
                  : "Ask about payments, onboarding, app issues, study flow, or anything else. You can also switch to WhatsApp if you need a faster reply."}
              </p>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    WhatsApp support
                  </div>
                  <div className="mt-2">Reach us directly at {SUPPORT_WHATSAPP_LABEL} for quick assistance.</div>
                  <a
                    href={SUPPORT_WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Open WhatsApp
                  </a>
                </div>

                {enterprise ? (
                  <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Building2 className="h-4 w-4 text-primary" />
                      Enterprise queue
                    </div>
                    <div className="mt-2">
                      These messages are tagged separately inside the admin workspace so follow-up does not get mixed up
                      with normal support tickets.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="border-primary/20 p-6 sm:p-8">
            <MarketingContactForm
              enterprise={enterprise}
              defaultSource={enterprise ? "enterprise" : "contact"}
              defaultTopic={enterprise ? "School onboarding" : "Payment challenges"}
            />
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
