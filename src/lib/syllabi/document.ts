import "server-only";

import { Buffer } from "node:buffer";
import { inflateRawSync, inflateSync } from "node:zlib";

export const MAX_SYLLABUS_FILE_BYTES = 8 * 1024 * 1024;

const ALLOWED_BY_MIME = new Set(["application/pdf", "text/plain", "text/markdown"]);
const ALLOWED_BY_EXT = new Set([".pdf", ".txt", ".md"]);

export type ParsedSyllabusDocument = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Buffer;
  extractedText: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extensionOf(fileName: string) {
  const lower = fileName.toLowerCase();
  const idx = lower.lastIndexOf(".");
  if (idx === -1) return "";
  return lower.slice(idx);
}

function detectDocumentType(file: File) {
  const mime = String(file.type || "").toLowerCase();
  if (ALLOWED_BY_MIME.has(mime)) return mime;

  const ext = extensionOf(file.name);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".txt") return "text/plain";
  if (ext === ".md") return "text/markdown";
  return mime || "application/octet-stream";
}

export function validateSyllabusDocument(file: File) {
  if (!(file instanceof File)) return "No file uploaded.";
  if (!file.size) return "Uploaded file is empty.";
  if (file.size > MAX_SYLLABUS_FILE_BYTES) {
    return `File is too large. Maximum size is ${Math.floor(MAX_SYLLABUS_FILE_BYTES / (1024 * 1024))}MB.`;
  }

  const type = detectDocumentType(file);
  const ext = extensionOf(file.name);
  if (!ALLOWED_BY_MIME.has(type) && !ALLOWED_BY_EXT.has(ext)) {
    return "Unsupported file type. Upload PDF, TXT, or Markdown.";
  }
  return null;
}

function decodePdfLiteral(raw: string) {
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }

    const next = raw[i + 1];
    if (!next) break;

    if (/[0-7]/.test(next)) {
      let oct = next;
      if (/[0-7]/.test(raw[i + 2] ?? "")) oct += raw[i + 2];
      if (/[0-7]/.test(raw[i + 3] ?? "")) oct += raw[i + 3];
      out += String.fromCharCode(parseInt(oct, 8));
      i += oct.length;
      continue;
    }

    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "b") out += "\b";
    else if (next === "f") out += "\f";
    else out += next;
    i += 1;
  }
  return out;
}

function decodePdfHex(raw: string) {
  const hex = raw.replace(/\s+/g, "");
  if (!hex) return "";
  const safe = hex.length % 2 === 0 ? hex : `${hex}0`;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(safe, "hex");
  } catch {
    return "";
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return out;
  }

  return bytes.toString("utf8");
}

function decodePdfToken(token: string) {
  if (token.startsWith("(") && token.endsWith(")")) {
    return decodePdfLiteral(token.slice(1, -1));
  }
  if (token.startsWith("<") && token.endsWith(">")) {
    return decodePdfHex(token.slice(1, -1));
  }
  return "";
}

function pushCandidate(set: Set<string>, value: string) {
  const text = normalizeWhitespace(value);
  if (text.length >= 2) set.add(text);
}

function collectPdfTextOperators(content: string, out: Set<string>) {
  const directPattern = /(\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]+>)\s*(?:Tj|'|")/g;
  let direct: RegExpExecArray | null;
  while ((direct = directPattern.exec(content))) {
    pushCandidate(out, decodePdfToken(direct[1] ?? ""));
  }

  const arrayPattern = /\[(.*?)\]\s*TJ/gs;
  let arr: RegExpExecArray | null;
  while ((arr = arrayPattern.exec(content))) {
    const body = arr[1] ?? "";
    const tokenPattern = /\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]+>/g;
    let token: RegExpExecArray | null;
    while ((token = tokenPattern.exec(body))) {
      pushCandidate(out, decodePdfToken(token[0] ?? ""));
    }
  }
}

function tryInflate(buffer: Buffer) {
  const out: Buffer[] = [];
  try {
    const inflated = inflateSync(buffer);
    if (inflated.length) out.push(inflated);
  } catch {
    // best-effort PDF stream decompression
  }
  try {
    const inflatedRaw = inflateRawSync(buffer);
    if (inflatedRaw.length) out.push(inflatedRaw);
  } catch {
    // best-effort PDF stream decompression
  }
  return out;
}

function extractTextFromPdf(bytes: Buffer) {
  const snippets = new Set<string>();
  const raw = bytes.toString("latin1");
  collectPdfTextOperators(raw, snippets);

  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let stream: RegExpExecArray | null;
  while ((stream = streamPattern.exec(raw))) {
    const payload = Buffer.from(stream[1] ?? "", "latin1");
    for (const candidate of tryInflate(payload)) {
      collectPdfTextOperators(candidate.toString("latin1"), snippets);
    }
  }

  const joined = normalizeWhitespace(Array.from(snippets).join(" "));
  if (joined.length >= 120) return joined;

  const printable = normalizeWhitespace(raw.replace(/[^\x20-\x7E\r\n\t]+/g, " "));
  return printable;
}

export async function parseSyllabusDocument(file: File): Promise<ParsedSyllabusDocument> {
  const issue = validateSyllabusDocument(file);
  if (issue) throw new Error(issue);

  const mimeType = detectDocumentType(file);
  const bytes = Buffer.from(await file.arrayBuffer());

  const extractedRaw =
    mimeType === "application/pdf" ? extractTextFromPdf(bytes) : bytes.toString("utf8");

  const extractedText = normalizeWhitespace(extractedRaw).slice(0, 48000);
  if (extractedText.length < 120) {
    throw new Error(
      "Could not extract enough readable text from this file. Use a text-based PDF or upload TXT/MD."
    );
  }

  return {
    fileName: file.name || `syllabus-${Date.now()}`,
    mimeType,
    sizeBytes: file.size,
    bytes,
    extractedText
  };
}
