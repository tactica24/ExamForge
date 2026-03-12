"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DISMISS_KEY = "ace_naija_install_prompt_dismissed_at";
const DISMISS_MS = 1000 * 60 * 60 * 24 * 7;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosSafari() {
  if (typeof window === "undefined") return false;

  const ua = window.navigator.userAgent.toLowerCase();
  const isAppleMobile = /iphone|ipad|ipod/.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|chrome|android/.test(ua);

  return isAppleMobile && isSafari;
}

function wasDismissedRecently() {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_MS;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures.
  }
}

function clearDismissal() {
  try {
    window.localStorage.removeItem(DISMISS_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (isStandaloneMode() || wasDismissedRecently()) return;

    if (isIosSafari()) {
      setShowIosHint(true);
      setVisible(true);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (isStandaloneMode() || wasDismissedRecently()) return;
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShowIosHint(false);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      clearDismissal();
      setInstallEvent(null);
      setShowIosHint(false);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (!visible) return null;

  const title = showIosHint ? "Install ACE NAIJA" : "Get the app";
  const description = showIosHint
    ? "On iPhone or iPad, tap Share in Safari, then choose Add to Home Screen."
    : "Install ACE NAIJA for faster access, offline support, and an app-like experience.";

  async function handleInstall() {
    if (!installEvent) return;

    setIsInstalling(true);

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);

      if (choice.outcome === "accepted") {
        clearDismissal();
        setVisible(false);
        return;
      }

      rememberDismissal();
      setVisible(false);
    } finally {
      setIsInstalling(false);
    }
  }

  function handleDismiss() {
    rememberDismissal();
    setInstallEvent(null);
    setShowIosHint(false);
    setVisible(false);
  }

  return (
    <div className="page-enter fixed inset-x-4 bottom-4 z-50 md:left-auto md:right-6 md:w-[360px]">
      <Card className="border-primary/20 bg-card/95 shadow-[0_20px_50px_-24px_hsl(var(--foreground)/0.35)] backdrop-blur">
        <CardHeader className="space-y-2 p-5 pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 p-5 pt-0">
          {installEvent ? (
            <>
              <Button className="flex-1" onClick={handleInstall} disabled={isInstalling}>
                {isInstalling ? "Opening..." : "Install app"}
              </Button>
              <Button variant="ghost" onClick={handleDismiss}>
                Not now
              </Button>
            </>
          ) : (
            <Button className="flex-1" onClick={handleDismiss}>
              Dismiss
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}