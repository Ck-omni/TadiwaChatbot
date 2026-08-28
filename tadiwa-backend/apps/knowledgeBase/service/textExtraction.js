import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { AppError } from "../../../utils/appError.js";

// Knowledge-base entries started out as PDF-only (uploaded guides, manually
// re-typed into `content`). This is the extraction layer behind
// POST /api/knowledge-base/upload — it turns a few common document formats
// into the plain text `content` a KnowledgeBaseEntry actually stores, so
// authoring an entry can be "upload the document" instead of "copy-paste
// its text by hand".
//
// Adding a format: give it a branch below that returns plain text, and add
// its mimetype (and, since browsers/OSes disagree on mimetypes for these
// formats, its extension as a fallback) to ACCEPTED_TYPES in
// controller/knowledgeBase.js's multer fileFilter.

async function extractPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractPlainText(buffer) {
  return buffer.toString("utf-8");
}

const EXTRACTORS = {
  pdf: extractPdf,
  docx: extractDocx,
  text: extractPlainText,
};

// Maps both mimetype and file extension to one of the extractor kinds above
// — uploads commonly arrive as application/octet-stream or another generic
// type depending on the browser/OS, so extension is the more reliable signal
// and is checked first.
const EXTENSION_KIND = {
  pdf: "pdf",
  docx: "docx",
  txt: "text",
  md: "text",
  markdown: "text",
};

const MIMETYPE_KIND = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "text",
  "text/markdown": "text",
};

export function extensionOf(filename) {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function detectKind(filename, mimetype) {
  return EXTENSION_KIND[extensionOf(filename)] || MIMETYPE_KIND[mimetype] || null;
}

// Extension/mimetype whitelist shown in error messages and used by the
// upload route's multer fileFilter — kept here, next to the extractors that
// actually implement each kind, so the two can't drift apart.
export const ACCEPTED_EXTENSIONS = Object.keys(EXTENSION_KIND);

export async function extractText(buffer, filename, mimetype) {
  const kind = detectKind(filename, mimetype);
  if (!kind) {
    throw new AppError(
      `Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(", ")}.`,
      415
    );
  }

  let text;
  try {
    text = await EXTRACTORS[kind](buffer);
  } catch (e) {
    throw new AppError(`Could not read this ${kind.toUpperCase()} file: ${e.message}`, 422);
  }

  const trimmed = (text || "").trim();
  if (!trimmed) {
    throw new AppError("No extractable text was found in this file.", 422);
  }
  return trimmed;
}

export default extractText;
