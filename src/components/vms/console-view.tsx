"use client";
import { Clipboard, Keyboard, Maximize2, Power, RefreshCw, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Instance } from "@/lib/types";

/**
 * Browser console shell. Phase 3: VMs mount noVNC (RFB over websockify) and containers
 * mount xterm.js against the provider's exec WebSocket, using the URL from getConsole().
 * With the Mock Provider there is no framebuffer, so a simulated screen is shown.
 */
export function ConsoleView({ inst }: { inst: Instance }) {
  const [nonce, setNonce] = useState(0);
  const isVm = inst.type === "vm";
  const running = inst.status === "running";

  const tools = [
    { icon: Maximize2, label: "Fullscreen", onClick: () => void document.getElementById(`console-${inst.id}`)?.requestFullscreen?.() },
    { icon: Keyboard, label: "Ctrl+Alt+Del", onClick: () => toast.info("Ctrl+Alt+Del sent (mock)"), hidden: !isVm },
    { icon: RefreshCw, label: "Reconnect", onClick: () => { setNonce((n) => n + 1); toast.info("Reconnecting console…"); } },
    { icon: Clipboard, label: "Clipboard", onClick: async () => { const t = await navigator.clipboard?.readText?.().catch(() => ""); toast.info(t ? `Would paste ${t.length} chars (mock)` : "Clipboard is empty or blocked"); } },
    { icon: Power, label: "Power", onClick: () => toast.info("Use the power buttons in the header") },
  ];

  return (
    <div id={`console-${inst.id}`} className="overflow-hidden rounded-xl border bg-black">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-zinc-900 px-2 py-1.5">
        <span className="mr-auto px-2 font-mono text-xs text-zinc-400">
          {isVm ? "noVNC" : "WebSocket terminal"} · {inst.name}
        </span>
        {tools.filter((t) => !t.hidden).map((t) => (
          <Button key={t.label} size="sm" variant="ghost" className="text-zinc-300 hover:bg-white/10 hover:text-white" onClick={t.onClick} disabled={!running}>
            <t.icon /> <span className="hidden sm:inline">{t.label}</span>
          </Button>
        ))}
      </div>
      <div key={nonce} className="relative aspect-video min-h-72 p-4 font-mono text-[13px] leading-relaxed text-zinc-300">
        {!running ? (
          <div className="absolute inset-0 grid place-items-center text-center text-zinc-500">
            <div>
              <Unplug className="mx-auto mb-2 size-6" />
              <p className="text-sm">{inst.name} is {inst.status}. Start it to open the console.</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-amber-400">[mock] No hypervisor connected — this is a simulated console.</p>
            <p>&nbsp;</p>
            <p>{inst.os.family === "windows" ? "Windows Server — Press Ctrl+Alt+Del to sign in." : `${inst.os.family[0].toUpperCase()}${inst.os.family.slice(1)} ${inst.os.version} ${inst.name} tty1`}</p>
            {inst.os.family !== "windows" && (
              <>
                <p>&nbsp;</p>
                <p>{inst.name} login: <span className="animate-pulse">▋</span></p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
