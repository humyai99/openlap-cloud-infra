import { route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async ({ principal: p }) => ({
  id: p.userId,
  name: p.name,
  email: p.email,
  via: p.via,
  permissions: [...p.global],
  projects: Object.fromEntries([...p.byProject].map(([k, v]) => [k, [...v]])),
}));
