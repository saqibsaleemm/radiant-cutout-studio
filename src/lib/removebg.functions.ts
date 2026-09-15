import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  /** Base64 (no data URL prefix) of a PNG/JPEG image. */
  imageBase64: z.string().min(16),
});

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

/** Removes the background using the remove.bg API and returns a transparent PNG as base64. */
export const removeBackgroundRemote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["REMOVE_BG_API_KEY"];
    if (!apiKey) throw new Error("Background removal service is not configured.");

    const bytes = base64ToBytes(data.imageBase64);
    const form = new FormData();
    form.append("image_file", new Blob([bytes], { type: "image/png" }), "image.png");
    form.append("size", "auto");
    form.append("format", "png");

    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
    });

    if (!res.ok) {
      let message = `Background removal failed (${res.status}).`;
      try {
        const body = (await res.json()) as { errors?: Array<{ title?: string }> };
        const title = body.errors?.[0]?.title;
        if (title) message = title;
      } catch {
        /* keep default message */
      }
      throw new Error(message);
    }

    const buffer = new Uint8Array(await res.arrayBuffer());
    return { pngBase64: bytesToBase64(buffer) };
  });
