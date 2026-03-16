"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingContactForm } from "@/components/marketing/contact-form";

export function ContactRevealCard() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="relative overflow-hidden border-primary/20 p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative">
        <Badge className="mb-3 rounded-full">Contact us</Badge>
        <h3 className="text-lg font-semibold">Need help or clarity?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a message, ask a quick question on WhatsApp, or open the full contact page.
        </p>
        {!isOpen ? (
          <div className="mt-5 flex flex-col gap-2">
            <Button className="w-full" onClick={() => setIsOpen(true)}>
              Send a message
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/contact">Open contact page</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-5">
            <MarketingContactForm compact />
          </div>
        )}
      </div>
    </Card>
  );
}
