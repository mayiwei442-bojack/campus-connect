export const MAX_PERSONA_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_PERSONA_IMAGE_ANALYSIS_BYTES = 7 * 1024 * 1024;

export const PERSONA_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const allowedMimeTypes = new Set<string>(PERSONA_IMAGE_MIME_TYPES);

type PersonaImageCandidate = {
  size: number;
  type: string;
};

export function validatePersonaImage(file: PersonaImageCandidate) {
  if (file.size < 1) return "请选择图片。";
  if (!allowedMimeTypes.has(file.type)) return "请选择 JPG、PNG 或 WebP 图片。";
  if (file.size > MAX_PERSONA_IMAGE_BYTES) return "请选择 50 MB 以内的 JPG、PNG 或 WebP 图片。";
  return null;
}

export function personaImageExtension(mimeType: string) {
  return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
}
