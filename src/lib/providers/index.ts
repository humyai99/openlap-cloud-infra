// Imported by the standalone job worker too, so no "server-only" marker here.
import type { ProviderKind } from "@/lib/types";
import { incusProvider } from "./incus";
import { libvirtProvider } from "./libvirt";
import { mockProvider } from "./mock";
import type { VirtualizationProvider } from "./types";

/**
 * Provider registry. Each node declares its provider kind; the worker resolves
 * the adapter here. Only "mock" is functional until Phase 3.
 */
const registry: Partial<Record<ProviderKind, VirtualizationProvider>> = {
  mock: mockProvider,
  incus: incusProvider,
  libvirt: libvirtProvider,
};

export function getProvider(kind: ProviderKind | string = process.env.OPENLAB_PROVIDER || "mock"): VirtualizationProvider {
  const p = registry[kind.toLowerCase() as ProviderKind];
  if (!p) throw new Error(`No virtualization provider registered for "${kind}"`);
  return p;
}

export type * from "./types";
