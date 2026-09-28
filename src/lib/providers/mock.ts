import { generateMetrics } from "@/lib/mock/data";
import type { InstanceStatus } from "@/lib/types";
import type { ProviderInstanceState, VirtualizationProvider } from "./types";

/**
 * MOCK PROVIDER — simulates a hypervisor. It does NOT create real VMs.
 * It keeps only "hypervisor-side" power state in memory; the database stays the
 * source of truth for everything else. Delays emulate real provider latency.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const g = globalThis as unknown as { __mockHv?: Map<string, InstanceStatus> };
const hv = (g.__mockHv ??= new Map());

const mac = () => {
  const b = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
  return `52:54:00:${b()}:${b()}:${b()}`;
};
const ip = () => `10.10.0.${Math.floor(Math.random() * 120) + 100}`;
const state = (ref: string, status: InstanceStatus): ProviderInstanceState => {
  hv.set(ref, status);
  return { ref, status, ipv4: status === "running" ? ip() : null };
};

export const mockProvider: VirtualizationProvider = {
  kind: "mock",
  isReal: false,

  async createVM(_node, spec, onProgress) {
    const ref = `mock-${spec.name}-${Math.random().toString(36).slice(2, 7)}`;
    // Steps: create, allocate storage, configure network, install OS, start.
    for (let step = 0; step < 5; step++) {
      await onProgress?.(step);
      await sleep(1000 + Math.random() * 600);
    }
    hv.set(ref, "running");
    return { ref, macAddress: mac(), ipv4: spec.network.ipMode === "static" && spec.network.staticIp ? spec.network.staticIp.split("/")[0] : ip() };
  },
  async deleteVM(_n, ref) {
    await sleep(800);
    hv.delete(ref);
  },
  async startVM(_n, ref) {
    await sleep(1500);
    return state(ref, "running");
  },
  async stopVM(_n, ref) {
    await sleep(1500);
    return state(ref, "stopped");
  },
  async restartVM(_n, ref) {
    await sleep(2000);
    return state(ref, "running");
  },
  async getVM(_n, ref) {
    const s = hv.get(ref);
    return s ? { ref, status: s, ipv4: null } : null;
  },
  async listVM() {
    return [...hv.entries()].map(([ref, status]) => ({ ref, status, ipv4: null }));
  },
  async cloneVM(_n, _ref, newName) {
    await sleep(2500);
    const ref = `mock-${newName}-${Math.random().toString(36).slice(2, 7)}`;
    hv.set(ref, "stopped");
    return { ref, macAddress: mac(), ipv4: null };
  },
  async resizeVM() {
    await sleep(800);
  },
  async createSnapshot() {
    await sleep(1500);
    return { sizeGb: Math.round(Math.random() * 30) / 10 + 0.3 };
  },
  async restoreSnapshot() {
    await sleep(2000);
  },
  async deleteSnapshot() {
    await sleep(700);
  },
  async getConsole(_n, _ref, type) {
    return { kind: type === "vm" ? "vnc" : "terminal", url: null, token: "mock", expiresAt: new Date(Date.now() + 60_000).toISOString() };
  },
  async getMetrics(_n, ref, range) {
    const seed = [...ref].reduce((a, c) => a + c.charCodeAt(0), 0);
    const span = range.to - range.from;
    const r = span <= 3_600_000 ? "1h" : span <= 21_600_000 ? "6h" : span <= 86_400_000 ? "24h" : "7d";
    return generateMetrics(r, seed);
  },
};
