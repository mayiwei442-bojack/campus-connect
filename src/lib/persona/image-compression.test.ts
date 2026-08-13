import { randomBytes } from "node:crypto";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { MAX_PERSONA_IMAGE_ANALYSIS_BYTES } from "./assets";
import {
  PersonaImageCompressionError,
  preparePersonaImageForAnalysis,
} from "./image-compression";

describe("preparePersonaImageForAnalysis", () => {
  it("keeps an image that already fits the AI request boundary", async () => {
    const input = Buffer.from("small-image-placeholder");
    const result = await preparePersonaImageForAnalysis(input, "image/jpeg");

    expect(result.bytes).toBe(input);
    expect(result.compressed).toBe(false);
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("compresses an oversized image below the AI request boundary", async () => {
    const width = 2800;
    const height = 2800;
    const source = await sharp(randomBytes(width * height * 3), {
      raw: { channels: 3, height, width },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();

    expect(source.length).toBeGreaterThan(MAX_PERSONA_IMAGE_ANALYSIS_BYTES);

    const result = await preparePersonaImageForAnalysis(source, "image/png");

    expect(result.compressed).toBe(true);
    expect(result.mimeType).toBe("image/webp");
    expect(result.bytes.length).toBeLessThan(MAX_PERSONA_IMAGE_ANALYSIS_BYTES);
    expect(result.originalByteSize).toBe(source.length);
    await expect(sharp(result.bytes).metadata()).resolves.toMatchObject({ format: "webp" });
  }, 20_000);

  it("returns the user-facing compression error when an oversized payload cannot be decoded", async () => {
    const invalidImage = Buffer.alloc(MAX_PERSONA_IMAGE_ANALYSIS_BYTES + 1, 1);

    await expect(preparePersonaImageForAnalysis(invalidImage, "image/png"))
      .rejects.toEqual(new PersonaImageCompressionError());
  });
});
