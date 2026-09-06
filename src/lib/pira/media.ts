import { supabase } from "@/integrations/supabase/client";

const BUCKET = "pira-media";
const cache = new Map<string, string>();

export async function uploadMedia(userId: string, file: File | Blob, ext = "png") {
  const name = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(name, file, {
    contentType: file instanceof File ? file.type : `image/${ext}`,
    upsert: false,
  });
  if (error) throw error;
  return name;
}

export function fileExt(file: File) {
  const parts = file.name.split(".");
  return (parts.length > 1 ? parts.pop() : "png")!.toLowerCase();
}

export async function resolveMedia(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("blob:")) return path;
  const hit = cache.get(path);
  if (hit) return hit;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 12);
  if (error || !data) return null;
  cache.set(path, data.signedUrl);
  return data.signedUrl;
}

/** Shrink an image file, keeping its aspect ratio (used for avatars/covers/stickers). */
export async function shrinkImage(
  file: File | Blob,
  max = 512,
  mime: "image/png" | "image/webp" | "image/jpeg" = "image/png",
  quality = 0.9,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), mime, quality));
}
