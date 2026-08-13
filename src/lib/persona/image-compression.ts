import sharp from "sharp";

import { MAX_PERSONA_IMAGE_ANALYSIS_BYTES } from "./assets";

const MAX_INPUT_PIXELS = 100_000_000;

const compressionAttempts = [
  { maximumDimension: 4096, quality: 82 },
  { maximumDimension: 3072, quality: 74 },
  { maximumDimension: 2560, quality: 66 },
  { maximumDimension: 2048, quality: 58 },
  { maximumDimension: 1600, quality: 50 },
  { maximumDimension: 1280, quality: 42 },
] as const;

export class PersonaImageCompressionError extends Error {
  constructor() {
    super("图片无法压缩至 7 MB 以下，请更换图片或先手动压缩后重试。");
    this.name = "PersonaImageCompressionError";
  }
}

export type PreparedPersonaAnalysisImage = {
  bytes: Buffer;
  compressed: boolean;
  mimeType: string;
  originalByteSize: number;
};

export async function preparePersonaImageForAnalysis(
  input: Buffer,
  mimeType: string,
): Promise<PreparedPersonaAnalysisImage> {
  if (input.length <= MAX_PERSONA_IMAGE_ANALYSIS_BYTES) {
    return { bytes: input, compressed: false, mimeType, originalByteSize: input.length };
  }

  try {
    for (const attempt of compressionAttempts) {
      const bytes = await sharp(input, {
        failOn: "error",
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .rotate()
        .resize({
          width: attempt.maximumDimension,
          height: attempt.maximumDimension,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          alphaQuality: attempt.quality,
          effort: 3,
          quality: attempt.quality,
          smartSubsample: true,
        })
        .toBuffer();

      if (bytes.length < MAX_PERSONA_IMAGE_ANALYSIS_BYTES) {
        return {
          bytes,
          compressed: true,
          mimeType: "image/webp",
          originalByteSize: input.length,
        };
      }
    }
  } catch {
    throw new PersonaImageCompressionError();
  }

  throw new PersonaImageCompressionError();
}
