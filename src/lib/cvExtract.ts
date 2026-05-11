import mammoth from "mammoth";
import multer from "multer";
import { createWorker } from "tesseract.js";

export const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
    files: 1
  },
  fileFilter(_req, file, cb) {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg",
      "image/webp"
    ];
    cb(null, allowed.includes(file.mimetype));
  }
});

export async function extractCvText(file?: Express.Multer.File) {
  if (!file) return "";

  if (file.mimetype === "application/pdf") {
    const mod = await import("pdf-parse");
    const parsePdf = (mod as any).default ?? mod;
    const result = await parsePdf(file.buffer);
    return cleanText(result.text || "");
  }

  if (
    file.mimetype === "application/msword" ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return cleanText(result.value || "");
  }

  if (file.mimetype.startsWith("image/")) {
    const worker = await createWorker("ara+eng");
    try {
      const result = await worker.recognize(file.buffer);
      return cleanText(result.data.text || "");
    } finally {
      await worker.terminate();
    }
  }

  return "";
}

function cleanText(value: string) {
  return value.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 12000);
}
