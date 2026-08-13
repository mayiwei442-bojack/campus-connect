import { describe, expect, it } from "vitest";

import {
  MAX_PERSONA_IMAGE_BYTES,
  personaImageExtension,
  validatePersonaImage,
} from "./assets";

describe("Persona image uploads", () => {
  it("accepts supported images through the 50 MiB boundary", () => {
    expect(validatePersonaImage({ size: MAX_PERSONA_IMAGE_BYTES, type: "image/jpeg" })).toBeNull();
    expect(validatePersonaImage({ size: MAX_PERSONA_IMAGE_BYTES, type: "image/png" })).toBeNull();
    expect(validatePersonaImage({ size: MAX_PERSONA_IMAGE_BYTES, type: "image/webp" })).toBeNull();
  });

  it("rejects oversized or unsupported files", () => {
    expect(validatePersonaImage({ size: MAX_PERSONA_IMAGE_BYTES + 1, type: "image/jpeg" })).toContain("50 MB");
    expect(validatePersonaImage({ size: 1024, type: "image/gif" })).toContain("JPG、PNG 或 WebP");
    expect(validatePersonaImage({ size: 0, type: "image/png" })).toBe("请选择图片。");
  });

  it("uses an extension that matches the trusted MIME type", () => {
    expect(personaImageExtension("image/jpeg")).toBe("jpg");
    expect(personaImageExtension("image/png")).toBe("png");
    expect(personaImageExtension("image/webp")).toBe("webp");
  });
});
