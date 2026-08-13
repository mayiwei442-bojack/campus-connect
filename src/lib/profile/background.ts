export const MAX_PROFILE_BACKGROUND_BYTES = 6 * 1024 * 1024;

export const PROFILE_BACKGROUND_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const allowedMimeTypes = new Set<string>(PROFILE_BACKGROUND_MIME_TYPES);

type ProfileBackgroundCandidate = {
  size: number;
  type: string;
};

export function validateProfileBackground(file: ProfileBackgroundCandidate) {
  if (file.size < 1) return "请选择一张图片。";
  if (!allowedMimeTypes.has(file.type)) return "请选择 JPG、PNG 或 WebP 图片。";
  if (file.size > MAX_PROFILE_BACKGROUND_BYTES) return "背景图片不能超过 6 MB。";
  return null;
}

export function profileBackgroundExtension(mimeType: string) {
  return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
}
