import { getProvider } from "@/lib/providers";
import { route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Reports which provider backs the API so the UI can show a "Mock Provider" banner. */
export const GET = route(async () => {
  const p = getProvider();
  return { provider: p.kind, isReal: p.isReal, version: "0.2.0-phase2" };
});
