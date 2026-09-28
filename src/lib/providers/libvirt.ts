import { ProviderNotImplementedError, type VirtualizationProvider } from "./types";

/**
 * libvirt + KVM/QEMU adapter — NOT IMPLEMENTED (Phase 3, after Incus).
 *
 * libvirt has no HTTP API, so this adapter is expected to talk to a small
 * per-node agent (e.g. libvirt-go / libvirt-python over qemu+tls://) that
 * exposes domain define/start/destroy, snapshot-create-as, virsh vncdisplay
 * (proxied to noVNC via websockify) and node metrics via node_exporter.
 */
function notImplemented(method: string): never {
  throw new ProviderNotImplementedError("libvirt", method);
}

export const libvirtProvider: VirtualizationProvider = {
  kind: "libvirt",
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
