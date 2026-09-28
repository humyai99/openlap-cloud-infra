import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getProvider } from "@/lib/providers";
import { requireUser } from "@/lib/server/auth";
import { queries } from "@/lib/server/queries";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [nodes, alerts] = await Promise.all([queries.nodes(), queries.alerts()]);
  return (
    <div className="min-h-screen">
      <Sidebar nodes={nodes} />
      <div className="lg:pl-60">
        <Topbar user={{ name: user.name, email: user.email }} nodes={nodes} alerts={alerts} isRealProvider={getProvider().isReal} />
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
