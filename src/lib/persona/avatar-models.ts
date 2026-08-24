export const MAX_PERSONA_GLB_BYTES = 50 * 1024 * 1024;
export const PERSONA_GLB_MIME_TYPE = "model/gltf-binary";

const GLB_HEADER_BYTES = 12;
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const GLB_JSON_CHUNK_TYPE = 0x4e4f534a;
export const MAX_PERSONA_GLB_JSON_BYTES = 4 * 1024 * 1024;
const acceptedBrowserMimeTypes = new Set(["", PERSONA_GLB_MIME_TYPE, "application/octet-stream"]);

type PersonaGlbCandidate = {
  name: string;
  size: number;
  type: string;
};

export function validatePersonaGlbMetadata(file: PersonaGlbCandidate) {
  if (!file.name.toLowerCase().endsWith(".glb")) return "请选择 .glb 格式的 3D 模型。";
  if (file.size < GLB_HEADER_BYTES) return "这个 GLB 文件不完整。";
  if (file.size > MAX_PERSONA_GLB_BYTES) return "请选择 50 MB 以内的 GLB 文件。";
  if (!acceptedBrowserMimeTypes.has(file.type)) return "文件类型不是可识别的 GLB 模型。";
  return null;
}

export function validateGlbHeader(bytes: Uint8Array, expectedByteSize: number) {
  if (bytes.byteLength < GLB_HEADER_BYTES) return "GLB 文件头不完整。";

  const view = new DataView(bytes.buffer, bytes.byteOffset, GLB_HEADER_BYTES);
  if (view.getUint32(0, true) !== GLB_MAGIC) return "文件内容不是有效的 GLB 模型。";
  if (view.getUint32(4, true) !== GLB_VERSION) return "目前只支持 GLB 2.0 模型。";
  if (view.getUint32(8, true) !== expectedByteSize) return "GLB 文件声明的大小与实际文件不一致。";
  return null;
}

export function readGlbJsonChunkLength(bytes: Uint8Array, expectedByteSize: number) {
  const headerError = validateGlbHeader(bytes, expectedByteSize);
  if (headerError) return { error: headerError, jsonByteSize: 0 };
  if (bytes.byteLength < 20) return { error: "GLB 缺少场景描述数据。", jsonByteSize: 0 };

  const view = new DataView(bytes.buffer, bytes.byteOffset, 20);
  const jsonByteSize = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  if (chunkType !== GLB_JSON_CHUNK_TYPE) return { error: "GLB 的首个数据块不是有效的场景描述。", jsonByteSize: 0 };
  if (jsonByteSize < 2 || jsonByteSize > MAX_PERSONA_GLB_JSON_BYTES || jsonByteSize + 20 > expectedByteSize) {
    return { error: "GLB 场景描述过大或不完整。", jsonByteSize: 0 };
  }
  return { error: null, jsonByteSize };
}

function containsExternalUri(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsExternalUri);
  if (!value || typeof value !== "object") return false;

  return Object.entries(value).some(([key, child]) => (
    key === "uri" && typeof child === "string"
      ? !child.startsWith("data:")
      : containsExternalUri(child)
  ));
}

export function validateGlbJsonChunk(bytes: Uint8Array, jsonByteSize: number) {
  if (bytes.byteLength < 20 + jsonByteSize) return "GLB 场景描述不完整。";

  try {
    const jsonText = new TextDecoder("utf-8", { fatal: true })
      .decode(bytes.subarray(20, 20 + jsonByteSize))
      .replace(/[\u0000\u0020]+$/g, "");
    const document = JSON.parse(jsonText) as unknown;
    if (containsExternalUri(document)) return "GLB 不能引用站外贴图或其他外部文件。";
    return null;
  } catch {
    return "GLB 场景描述无法解析。";
  }
}

export async function validatePersonaGlb(file: File) {
  const metadataError = validatePersonaGlbMetadata(file);
  if (metadataError) return metadataError;

  const header = new Uint8Array(await file.slice(0, GLB_HEADER_BYTES).arrayBuffer());
  return validateGlbHeader(header, file.size);
}

export function personaGlbStoragePath(viewerId: string, personaId: string) {
  return `${viewerId}/${personaId}/${crypto.randomUUID()}.glb`;
}
