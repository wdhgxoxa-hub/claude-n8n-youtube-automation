import { currentUser } from "@/lib/sesion";
import { failure, json, rateLimit } from "@/lib/http";
import { tinteVideo } from "@/servicios/tinte-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    rateLimit(`tinte:${user.id}`, 120);
    const { id } = await context.params;
    return json({ color: await tinteVideo(user, id) });
  } catch (error) {
    return failure(error);
  }
}
