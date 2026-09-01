import { type NextRequest } from "next/server";
import { badBody, forward, guard, readJson } from "@/lib/admin-guard";

/**
 * Mail settings — read and write.
 *
 * The API key travels one way only. `GET` never returns it (the upstream sends
 * back whether one is set plus its last four characters), so there is no
 * response here that could leak it into a browser cache, a proxy log, or a
 * screenshot of the admin panel.
 */
export async function GET(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;
  return forward(auth.token, "/admin/mail-settings");
}

export async function PUT(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === undefined) return badBody();

  return forward(auth.token, "/admin/mail-settings", { method: "PUT", body });
}
