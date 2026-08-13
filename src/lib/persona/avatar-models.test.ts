import { describe, expect, it } from "vitest";

import {
  MAX_PERSONA_GLB_BYTES,
  readGlbJsonChunkLength,
  validateGlbHeader,
  validateGlbJsonChunk,
  validatePersonaGlbMetadata,
} from "./avatar-models";

function glbHeader(byteSize: number, version = 2) {
  const bytes = new Uint8Array(12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, version, true);
  view.setUint32(8, byteSize, true);
  return bytes;
}

function glbWithJson(document: unknown) {
  const encoded = new TextEncoder().encode(JSON.stringify(document));
  const jsonByteSize = Math.ceil(encoded.byteLength / 4) * 4;
  const bytes = new Uint8Array(20 + jsonByteSize);
  bytes.set(glbHeader(bytes.byteLength), 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(12, jsonByteSize, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(encoded, 20);
  bytes.fill(0x20, 20 + encoded.byteLength);
  return { bytes, jsonByteSize };
}

describe("Persona GLB validation", () => {
  it("accepts browser GLB metadata even when the browser omits MIME type", () => {
    expect(validatePersonaGlbMetadata({ name: "campus-me.glb", size: 120, type: "" })).toBeNull();
  });

  it("rejects non-GLB extensions and oversized files", () => {
    expect(validatePersonaGlbMetadata({ name: "model.gltf", size: 120, type: "model/gltf-binary" })).toMatch(".glb");
    expect(validatePersonaGlbMetadata({ name: "model.glb", size: MAX_PERSONA_GLB_BYTES + 1, type: "model/gltf-binary" })).toMatch("50 MB");
  });

  it("accepts a GLB 2.0 header whose declared length matches the object", () => {
    expect(validateGlbHeader(glbHeader(4096), 4096)).toBeNull();
  });

  it("rejects invalid magic, unsupported versions, and length mismatches", () => {
    const invalidMagic = glbHeader(4096);
    invalidMagic[0] = 0;

    expect(validateGlbHeader(invalidMagic, 4096)).toMatch("不是有效");
    expect(validateGlbHeader(glbHeader(4096, 1), 4096)).toMatch("GLB 2.0");
    expect(validateGlbHeader(glbHeader(2048), 4096)).toMatch("大小");
  });

  it("accepts self-contained scene data and rejects external resource URLs", () => {
    const embedded = glbWithJson({ asset: { version: "2.0" }, images: [{ uri: "data:image/png;base64,AA==" }] });
    const external = glbWithJson({ asset: { version: "2.0" }, images: [{ uri: "https://example.com/track.png" }] });

    expect(readGlbJsonChunkLength(embedded.bytes, embedded.bytes.byteLength)).toEqual({ error: null, jsonByteSize: embedded.jsonByteSize });
    expect(validateGlbJsonChunk(embedded.bytes, embedded.jsonByteSize)).toBeNull();
    expect(validateGlbJsonChunk(external.bytes, external.jsonByteSize)).toMatch("站外");
  });
});
