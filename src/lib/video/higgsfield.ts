import { readFile } from "node:fs/promises";

const DEFAULT_MODEL = process.env.HF_VIDEO_MODEL ?? "alibaba/wan-3.0/text-to-video";

export type HiggsfieldVideoInput = {
  prompt: string;
  model?: string;
  duration?: number;
  resolution?: "480p" | "720p" | "1080p";
  aspectRatio?: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "adaptive";
  generateAudio?: boolean;
};

function credentials() {
  const id = process.env.HF_API_KEY_ID;
  const secret = process.env.HF_API_KEY_SECRET;
  if (!id || !secret) {
    throw new Error("Higgsfield API credentials are not configured. Set HF_API_KEY_ID and HF_API_KEY_SECRET.");
  }
  return `Key ${id}:${secret}`;
}

function modelPath(model: string) {
  return model.replace(/^\\/+|\\/+$/g, "");
}

async function requestHiggsfield(path: string, init: RequestInit) {
  const response = await fetch(`https://api.higgsfield.ai/${modelPath(path)}`, {
    ...init,
    headers: {
      Authorization: credentials(),
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) {
    throw new Error(`Higgsfield API error ${response.status}: ${JSON.stringify(data)}`);
  }
  return data as Record<string, unknown>;
}

export async function generateHiggsfieldVideo(input: HiggsfieldVideoInput) {
  const model = input.model ?? DEFAULT_MODEL;
  return requestHiggsfield(model, {
    method: "POST",
    body: JSON.stringify({
      prompt: input.prompt,
      duration: input.duration ?? 5,
      resolution: input.resolution ?? "1080p",
      aspect_ratio: input.aspectRatio ?? "9:16",
      generate_audio: input.generateAudio ?? false,
      enable_thinking: false
    })
  });
}

export async function uploadHiggsfieldReference(filePath: string) {
  const buffer = await readFile(filePath);
  if (buffer.length === 0) throw new Error("Reference file is empty.");
  throw new Error("Reference upload is not wired yet. Use a public HTTPS media URL with a reference-to-video model.");
}
