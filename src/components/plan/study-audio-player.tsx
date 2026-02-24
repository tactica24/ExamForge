"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const languageMap: Record<string, string> = {
  en: "en-NG",
  pidgin: "en-NG",
  hausa: "ha-NG",
  yoruba: "yo-NG",
  igbo: "ig-NG"
};

function pickLanguage(value: string) {
  const key = String(value || "en").toLowerCase();
  return languageMap[key] ?? "en-NG";
}

function canUseSpeechSynthesis() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function StudyAudioPlayer(props: {
  text: string;
  language: string;
  downloadUrl?: string;
  downloadFileName?: string;
}) {
  const [status, setStatus] = useState<"idle" | "playing" | "paused" | "unsupported">("idle");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const targetLang = useMemo(() => pickLanguage(props.language), [props.language]);
  const hasText = Boolean(props.text?.trim());

  function play() {
    if (!hasText) return;
    if (!canUseSpeechSynthesis()) {
      setStatus("unsupported");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(props.text);
    utterance.lang = targetLang;
    utterance.rate = 0.95;
    utterance.onend = () => setStatus("idle");
    utterance.onerror = () => setStatus("idle");
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setStatus("playing");
  }

  function pause() {
    if (!canUseSpeechSynthesis()) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }

  function resume() {
    if (!canUseSpeechSynthesis()) return;
    window.speechSynthesis.resume();
    setStatus("playing");
  }

  function stop() {
    if (!canUseSpeechSynthesis()) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setStatus("idle");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={play} disabled={!hasText}>
          Play narration
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={status === "paused" ? resume : pause}
          disabled={status !== "playing" && status !== "paused"}
        >
          {status === "paused" ? "Resume" : "Pause"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={stop} disabled={status === "idle"}>
          Stop
        </Button>
        {props.downloadUrl ? (
          <Button asChild type="button" size="sm" variant="outline">
            <a href={props.downloadUrl} download={props.downloadFileName ?? "study-audio.mp3"}>
              Download audio file
            </a>
          </Button>
        ) : null}
      </div>
      {status === "unsupported" ? (
        <div className="text-xs text-muted-foreground">
          Audio playback is unavailable in this browser. You can still read the narration text below.
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          Status: {status === "playing" ? "Playing" : status === "paused" ? "Paused" : "Idle"}
        </div>
      )}
    </div>
  );
}
