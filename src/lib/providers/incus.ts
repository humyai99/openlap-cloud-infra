import type { ProviderKind } from "@/lib/types";
import { ProviderNotImplementedError, type VirtualizationProvider } from "./types";

/**
 * Incus adapter — NOT IMPLEMENTED (Phase 3).
 *
 * Planned mapping (Incus REST API over TLS client cert, https://<host>:8443/1.0):
 *   createVM        -> POST   /1.0/instances            (type: "virtual-machine" | "container")
 *   deleteVM        -> DELETE /1.0/instances/{name}
 *   start/stop/...  -> PUT    /1.0/instances/{name}/state { action }
 *   getVM / listVM  -> GET    /1.0/instances?recursion=2
 *   cloneVM         -> POST   /1.0/instances { source: { type: "copy" } }
 *   createSnapshot  -> POST   /1.0/instances/{name}/snapshots
 *   restoreSnapshot -> PUT    /1.0/instances/{name} { restore }
 *   getConsole      -> POST   /1.0/instances/{name}/console (vga -> SPICE/VNC, container -> exec websocket)
 *   getMetrics      -> GET    /1.0/metrics (Prometheus format)
 * Incus operations are async; the adapter must poll /1.0/operations/{id}/wait.
 */
function notImplemented(method: string): never {
  throw new ProviderNotImplementedError("incus", method);
}

export const incusProvider: VirtualizationProvider = {
  kind: "incus" satisfies ProviderKind,
  isReal: true,
  createVM: async () => notImplemented("createVM"),
  deleteVM: async () => notImplemented("deleteVM"),
  startVM: async () => notImplemented("startVM"),
  stopVM: async () => notImplemented("stopVM"),
  restartVM: async () => notImplemented("restartVM"),
  getVM: async () => notImplemented("getVM"),
  listVM: async () => notImplemented("listVM"),
  cloneVM: async () => notImplemented("cloneVM"),
  resizeVM: async () => notImplemented("resizeVM"),
  createSnapshot: async () => notImplemented("createSnapshot"),
  restoreSnapshot: async () => notImplemented("restoreSnapshot"),
  deleteSnapshot: async () => notImplemented("deleteSnapshot"),
  getConsole: async () => notImplemented("getConsole"),
  getMetrics: async () => notImplemented("getMetrics"),
};
