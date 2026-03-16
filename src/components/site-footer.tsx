import Link from "next/link";
import { MapPin, MessageCircle, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUPPORT_WHATSAPP_LABEL, SUPPORT_WHATSAPP_URL } from "@/lib/contact/requests";

const footerSections = [
  {
    title: "Platform",
    links: [
      { href: "/about", label: "About ACE NAIJA" },
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact us" }
    ]
  },
  {
    title: "Resources",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Start free trial" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms" }
    ]
  }
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-gradient-to-b from-background via-background to-cyan-100/20 dark:to-cyan-900/20">
      <div className="container py-12 sm:py-16">
        <div className="grid gap-8 rounded-[2rem] border border-border/70 bg-background/80 p-6 shadow-[0_24px_60px_-40px_hsl(var(--foreground)/0.35)] backdrop-blur sm:p-8 lg:grid-cols-[1.15fr_0.85fr_0.85fr]">
          <div className="space-y-5">
            <div>
              <Badge variant="secondary" className="rounded-full">
                ACE NAIJA
              </Badge>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight">Professional exam preparation for ambitious learners.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Built to turn syllabus pressure into a structured learning path with practice, reminders, mock exams,
                group accountability, and measurable progress.
              </p>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <span>Lamingo, Jos, Plateau State</span>
              </div>
              <div className="flex items-start gap-3">
                <PhoneCall className="mt-0.5 h-4 w-4 text-primary" />
                <span>{SUPPORT_WHATSAPP_LABEL}</span>
              </div>
              <div className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-4 w-4 text-primary" />
                <span>acenaija1@gmail.com</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="sm:w-auto">
                <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" /> Chat on WhatsApp
                </a>
              </Button>
              <Button asChild variant="secondary" className="sm:w-auto">
                <Link href="/contact">Send a message</Link>
              </Button>
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{section.title}</div>
              <div className="mt-4 grid gap-3 text-sm">
                {section.links.map((link) => (
                  <Link key={link.href} href={link.href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>(c) {new Date().getFullYear()} ACE NAIJA. Not affiliated with any exam body.</div>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy policy
            </Link>
            <Link href="/faq" className="hover:text-foreground">
              FAQ
            </Link>
            <Link href="/about" className="hover:text-foreground">
              About us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
