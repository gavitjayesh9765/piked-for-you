import { type NextRequest } from "next/server";
import { badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/**
 * Move a contact message through the queue, or attach an internal note.
 *
 * The queue screen had four status tabs and no way to change a status, so every
 * message stayed `new` for ever: "New" and "All" were the same list and the
 * other two tabs were permanently empty. This is the missing half.
 *
 * Nothing about the message's content is editable here — only how we are
 * handling it. The sender's words are a record of what they asked for.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (body === undefined) return badBody();

  return forward(auth.token, `/admin/messages/${id}`, { method: "PATCH", body });
}
