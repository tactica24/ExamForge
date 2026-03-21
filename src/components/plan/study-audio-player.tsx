"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

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

type VoicePreference = "default" | "female" | "male";

type VoiceChoice = {
  preference: VoicePreference;
  voiceURI: string;
  label: string;
};

function voicePreferenceLabel(value: VoicePreference) {
  if (value === "female") return "Prefer female voice";
  if (value === "male") return "Prefer male voice";
  return "Default voice";
}

function detectVoicePreference(voice: SpeechSynthesisVoice): Exclude<VoicePreference, "default"> | null {
  const key = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  if (/(female|woman|girl|zira|hazel|aria|samantha|victoria|joanna|karen|moira|susan|linda|amy|emma|ava)/i.test(key)) {
    return "female";
  }
  if (/(male|man|boy|david|mark|daniel|george|james|guy|alex|fred|tom|brian|matthew|arthur)/i.test(key)) {
    return "male";
  }
  return null;
}

function buildVoiceChoices(voices: SpeechSynthesisVoice[], language: string): VoiceChoice[] {
  const target = language.toLowerCase();
  const matching = voices.filter((voice) => voice.lang.toLowerCase().startsWith(target.slice(0, 2)));
  const pool = matching.length ? matching : voices;
  const choices: VoiceChoice[] = [{ preference: "default", voiceURI: "", label: "Default voice" }];
  const seen = new Set<VoicePreference>(["default"]);

  for (const voice of pool) {
    const preference = detectVoicePreference(voice);
    if (!preference || seen.has(preference)) continue;
    choices.push({
      preference,
      voiceURI: voice.voiceURI,
      label: voicePreferenceLabel(preference)
    });
    seen.add(preference);
  }

  return choices;
}

export function StudyAudioPlayer(props: {
  text: string;
  language: string;
  downloadUrl?: string;
  downloadFileName?: string;
}) {
  const [status, setStatus] = useState<"idle" | "playing" | "paused" | "unsupported">("idle");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicePreference, setVoicePreference] = useState<VoicePreference>("default");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const targetLang = useMemo(() => pickLanguage(props.language), [props.language]);
  const hasText = Boolean(props.text?.trim());
  const voiceChoices = useMemo(() => buildVoiceChoices(voices, targetLang), [voices, targetLang]);
  const selectedVoiceUri = useMemo(() => {
    const selected = voiceChoices.find((choice) => choice.preference === voicePreference);
    return selected?.voiceURI ?? "";
  }, [voiceChoices, voicePreference]);

  useEffect(() => {
    if (voiceChoices.some((choice) => choice.preference === voicePreference)) return;
    setVoicePreference("default");
  }, [voiceChoices, voicePreference]);

  useEffect(() => {
    if (!canUseSpeechSynthesis()) return;

    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

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
    if (selectedVoiceUri) {
      const selectedVoice = voices.find((voice) => voice.voiceURI === selectedVoiceUri);
      if (selectedVoice) utterance.voice = selectedVoice;
    }
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
      <div className="max-w-xs space-y-2">
        <label className="text-xs font-medium text-foreground" htmlFor="study-audio-voice">
          Voice
        </label>
        <NativeSelect
          id="study-audio-voice"
          value={voicePreference}
          onChange={(event) => setVoicePreference(event.target.value as VoicePreference)}
        >
          {voiceChoices.map((choice) => (
            <option key={`${choice.preference}-${choice.voiceURI || "default"}`} value={choice.preference}>
              {choice.label}
            </option>
          ))}
        </NativeSelect>
      </div>
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
          Status: {status === "playing" ? "Playing" : status === "paused" ? "Paused" : "Idle"}.
          {" "}
          {voicePreferenceLabel(voicePreference)} is selected for in-browser playback.
        </div>
      )}
    </div>
  );
}
