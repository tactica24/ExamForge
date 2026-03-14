import "server-only";

import { NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import { z } from "zod";
import { createBackendServerClient } from "@/lib/backend/server";
import { getPlanItemLessonAssets } from "@/lib/plans/content";
import { buildRateLimitKeyFromRequest } from "@/lib/security/request";
import { takeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const QuerySchema = z.object({
  item_id: z.string().uuid(),
  format: z.enum(["audio", "ppt"])
});

function safeFileName(value: string) {
  return String(value || "study-asset")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function mapLanguageForTts(value: string | null | undefined) {
  const key = String(value ?? "en").trim().toLowerCase();
  if (key === "hausa") return "ha";
  if (key === "yoruba") return "yo";
  if (key === "igbo") return "ig";
  return "en";
}

const GOOGLE_TTS_CHUNK_MAX = 180;

function splitTextForTts(text: string, maxLen = GOOGLE_TTS_CHUNK_MAX) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const words = normalized.split(" ");
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    if (!word) continue;
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLen) {
      current = next;
      continue;
    }

    if (current) chunks.push(current);
    if (word.length <= maxLen) {
      current = word;
      continue;
    }

    let offset = 0;
    while (offset < word.length) {
      const piece = word.slice(offset, offset + maxLen);
      if (piece) chunks.push(piece);
      offset += maxLen;
    }
    current = "";
  }

  if (current) chunks.push(current);
  return chunks.slice(0, 35);
}

function buildGoogleTtsUrl(args: { text: string; language: string }) {
  const params = new URLSearchParams({
    ie: "UTF-8",
    client: "tw-ob",
    tl: args.language,
    q: args.text
  });
  return `https://translate.google.com/translate_tts?${params.toString()}`;
}

async function makeAudioBuffer(args: { text: string; language: string }) {
  const text = String(args.text ?? "").replace(/\s+/g, " ").trim().slice(0, 5400);
  if (!text) return null;

  const chunks = splitTextForTts(text);

  if (!chunks.length) return null;

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const res = await fetch(buildGoogleTtsUrl({ text: chunk, language: args.language }), {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    buffers.push(Buffer.from(arrayBuffer));
  }

  if (!buffers.length) return null;
  return Buffer.concat(buffers);
}

async function makePptBuffer(args: {
  title: string;
  slides: Array<{
    slide_number: number;
    title: string;
    content: string[];
    visual_suggestions: string;
    visual: {
      kind: string;
      title: string;
      explanation: string;
      bullets: string[];
      points: Array<{ label: string; value: number }>;
    } | null;
  }>;
}) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "ACE NAIJA";
  pptx.company = "ACE NAIJA";
  pptx.subject = "ExamForge study deck";
  pptx.title = args.title;

  for (const slide of args.slides.slice(0, 10)) {
    const page = pptx.addSlide();
    page.background = { color: "F8FAFC" };

    page.addShape(pptx.ShapeType.roundRect, {
      x: 0.45,
      y: 0.3,
      w: 12.2,
      h: 0.58,
      fill: { color: "E0ECFF" },
      line: { color: "E0ECFF" }
    });

    page.addText(`${slide.slide_number}. ${slide.title}`, {
      x: 0.7,
      y: 0.4,
      w: 9.2,
      h: 0.4,
      fontSize: 18,
      bold: true,
      color: "102A43",
      fontFace: "Calibri"
    });

    const points = slide.content
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((entry) => ({ text: entry, options: { bullet: { indent: 14 } } }));

    if (points.length) {
      page.addText(points as any, {
        x: 0.8,
        y: 1.1,
        w: 7.15,
        h: 4.1,
        fontSize: 15,
        color: "243B53",
        breakLine: true,
        paraSpaceAfter: 10,
        valign: "top"
      });
    }

    const visual = slide.visual;
    if (visual) {
      page.addShape(pptx.ShapeType.roundRect, {
        x: 8.1,
        y: 1.05,
        w: 4.2,
        h: 4.45,
        fill: { color: "FFFFFF" },
        line: { color: "C3DAFE" }
      });

      page.addText(visual.title, {
        x: 8.35,
        y: 1.2,
        w: 3.7,
        h: 0.5,
        fontSize: 12,
        bold: true,
        color: "334E68"
      });

      page.addText(visual.explanation, {
        x: 8.35,
        y: 1.7,
        w: 3.7,
        h: 1.0,
        fontSize: 10,
        color: "486581",
        breakLine: true
      });

      const chartPoints = (visual.points ?? []).slice(0, 6);
      if (visual.kind === "graph" && chartPoints.length >= 2) {
        page.addChart(
          pptx.ChartType.bar,
          [
            {
              name: visual.title,
              labels: chartPoints.map((point) => String(point.label).slice(0, 28)),
              values: chartPoints.map((point) => Number(point.value) || 0)
            }
          ],
          {
            x: 8.3,
            y: 2.7,
            w: 3.75,
            h: 2.0,
            barDir: "col",
            showLegend: false,
            showValue: true,
            catAxisLabelRotate: -20,
            valAxisMinVal: 0
          }
        );
      } else {
        const visualBullets = (visual.bullets ?? [])
          .slice(0, 3)
          .map((entry) => ({ text: entry, options: { bullet: { indent: 12 } } }));
        if (visualBullets.length) {
          page.addText(visualBullets as any, {
            x: 8.35,
            y: 2.75,
            w: 3.6,
            h: 2.2,
            fontSize: 10,
            color: "334E68",
            breakLine: true,
            paraSpaceAfter: 8
          });
        }
      }
    } else {
      page.addShape(pptx.ShapeType.roundRect, {
        x: 8.1,
        y: 1.05,
        w: 4.2,
        h: 4.45,
        fill: { color: "FFFFFF" },
        line: { color: "D9E2EC" }
      });
      page.addText(slide.visual_suggestions || "Visual cue", {
        x: 8.35,
        y: 1.3,
        w: 3.7,
        h: 3.6,
        fontSize: 11,
        color: "627D98",
        breakLine: true,
        valign: "top"
      });
    }
  }

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer);
}

export async function GET(req: Request) {
  const rate = await takeRateLimit({
    key: buildRateLimitKeyFromRequest("api:plan:assets:download", req),
    windowMs: 15 * 60 * 1000,
    max: 40
  });
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many asset download attempts. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    item_id: url.searchParams.get("item_id"),
    format: url.searchParams.get("format")
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const backend = await createBackendServerClient();
  const {
    data: { user }
  } = await backend.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

  const { data: item } = await backend
    .from("plan_items")
    .select("id,plan_id,title,resource_links")
    .eq("id", parsed.data.item_id)
    .maybeSingle();
  if (!item) return NextResponse.json({ ok: false, message: "Topic not found." }, { status: 404 });

  const { data: plan } = await backend
    .from("user_plans")
    .select("id,user_id,subject")
    .eq("id", item.plan_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!plan) return NextResponse.json({ ok: false, message: "Not authorized." }, { status: 403 });

  const assets = getPlanItemLessonAssets(item.resource_links);
  const fileBase = safeFileName(`${plan.subject}-${item.title}`);

  if (parsed.data.format === "audio") {
    const narration = assets.audio?.narration ?? "";
    if (!narration) return NextResponse.json({ ok: false, message: "Audio not generated yet." }, { status: 404 });

    const { data: profile } = await backend
      .from("profiles")
      .select("preferred_explanation_language")
      .eq("user_id", user.id)
      .maybeSingle();
    const lang = mapLanguageForTts(profile?.preferred_explanation_language ?? "en");
    const audio = await makeAudioBuffer({ text: narration, language: lang });
    if (!audio) {
      return NextResponse.json({ ok: false, message: "Could not render audio file right now." }, { status: 502 });
    }

    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename=\"${fileBase}-audio.mp3\"`,
        "Cache-Control": "private, max-age=600"
      }
    });
  }

  const deck = assets.slides;
  if (!deck) return NextResponse.json({ ok: false, message: "PPT not generated yet." }, { status: 404 });

  const ppt = await makePptBuffer({
    title: `${plan.subject}: ${item.title}`,
    slides: deck.slides
  });

  return new NextResponse(new Uint8Array(ppt), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename=\"${fileBase}-slides.pptx\"`,
      "Cache-Control": "private, max-age=600"
    }
  });
}

