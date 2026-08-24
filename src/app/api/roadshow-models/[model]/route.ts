import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getViewerEmail } from "@/lib/auth/viewer";
import {
  getLocalRoadshowModelFilename,
  isPersonaShowcaseEmail,
} from "@/lib/persona/showcase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ model: string }> },
) {
  const { model } = await context.params;
  const filename = getLocalRoadshowModelFilename(model);
  if (!filename) return new NextResponse(null, { status: 404 });

  const viewerEmail = await getViewerEmail();
  if (!isPersonaShowcaseEmail(viewerEmail)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const bytes = await readFile(path.join(process.cwd(), "local-assets", "persona", filename));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "model/gltf-binary",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
