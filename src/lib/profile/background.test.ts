import { describe, expect, it } from "vitest";

import {
  MAX_PROFILE_BACKGROUND_BYTES,
  profileBackgroundExtension,
  validateProfileBackground,
} from "./background";

describe("profile background validation", () => {
  it("accepts supported images within the size limit", () => {
    expect(validateProfileBackground({ size: MAX_PROFILE_BACKGROUND_BYTES, type: "image/webp" })).toBeNull();
  });

  it("rejects empty, unsupported, and oversized uploads", () => {
    expect(validateProfileBackground({ size: 0, type: "image/jpeg" })).toBe("请选择一张图片。");
    expect(validateProfileBackground({ size: 200, type: "image/gif" })).toBe("请选择 JPG、PNG 或 WebP 图片。");
    expect(validateProfileBackground({ size: MAX_PROFILE_BACKGROUND_BYTES + 1, type: "image/png" })).toBe("背景图片不能超过 6 MB。");
  });

  it("uses a safe extension for every accepted MIME type", () => {
    expect(profileBackgroundExtension("image/jpeg")).toBe("jpg");
    expect(profileBackgroundExtension("image/png")).toBe("png");
    expect(profileBackgroundExtension("image/webp")).toBe("webp");
  });
});
