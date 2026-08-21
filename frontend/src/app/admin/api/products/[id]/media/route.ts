import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, badId, forward, guard, isId } from "@/lib/admin-guard";

/**
 * Product image upload and delete.
 *
 * The multipart body is passed through without being parsed or re-encoded
 * here. All real validation — decode, dimensions, EXIF strip, re-encode —
 * happens in FastAPI, which is the only layer that can be trusted to do it
 * because it is the only one every caller has to go through.
 *
 * What *is* enforced here is the size cap, before the body is buffered.
 * `request.formData()` reads the whole upload into this process's memory, so
 * without a check a single request can decide how much memory the server
 * spends. Mirrors `MAX_IMAGE_BYTES` in backend/app/core/config.py.
 */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Multipart framing and the field name, generously. */
const MULTIPART_OVERHEAD = 8 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const declared = Number(request.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD) {
    return NextResponse.json(
      { detail: "That file is larger than 8 MB." },
      { status: 413, headers: NO_STORE },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { detail: "Could not read the upload." },
      { status: 400, headers: NO_STORE },
    );
  }

  // Content-Length can lie, or be absent on a chunked request. Re-check against
  // what actually arrived.
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ detail: "No file supplied." }, { status: 400, headers: NO_STORE });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { detail: "That file is larger than 8 MB." },
      { status: 413, headers: NO_STORE },
    );
  }

  return forward(auth.token, `/admin/media/product/${id}`, { method: "POST", form });
}

export async function DELETE(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  // The media id arrives in the query rather than the path, and was previously
  // interpolated into an upstream URL with only a presence check.
  const mediaId = request.nextUrl.searchParams.get("mediaId");
  if (!isId(mediaId)) return badId();

  return forward(auth.token, `/admin/media/product/${mediaId}`, { method: "DELETE" });
}
