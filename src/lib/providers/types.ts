import type { InstanceStatus, InstanceType, MetricPoint, OsFamily, ProviderKind } from "@/lib/types";

/**
 * Hypervisor-agnostic contract.
 *
 * Adapters are deliberately thin: they only know hypervisor-side identifiers
 * (`ref`). Tenancy, quotas, RBAC, audit and persistence live in the service
 * layer + job worker, so adding a hypervisor never touches business logic.
 */
export interface ProvisionSpec {
  type: InstanceType;
  name: string;
  os: { family: OsFamily; version: string; isoRef?: string };
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  diskType: "ssd" | "hdd" | "nvme";
  storagePool: string; // provider-side pool name
  network: { bridge: string; vlanId: number | null; ipMode: "dhcp" | "static"; staticIp?: string; gateway?: string; dns?: string[] };
  firewallEnabled: boolean;
  sshKey?: string;
  cloudInit?: string;
}

/** Node connection details handed to the adapter (credential already decrypted by the service layer). */
export interface NodeTarget {
  name: string;
  address: string;
  credential: string | null;
}

export interface ProvisionResult {
  ref: string;
  macAddress: string;
  ipv4: string | null;
}

export interface ProviderInstanceState {
  ref: string;
  status: InstanceStatus;
  ipv4: string | null;
}

export interface ConsoleSession {
  kind: "vnc" | "terminal";
  /** WebSocket URL the browser connects to (noVNC / xterm). null when unavailable. */
  url: string | null;
  token: string;
  expiresAt: string;
}

/** Long-running calls report step transitions so the job worker can stream progress. */
export type ProgressFn = (stepIndex: number) => void | Promise<void>;

export interface VirtualizationProvider {
  readonly kind: ProviderKind;
  /** True only when talking to a real hypervisor. */
  readonly isReal: boolean;

  createVM(node: NodeTarget, spec: ProvisionSpec, onProgress?: ProgressFn): Promise<ProvisionResult>;
  deleteVM(node: NodeTarget, ref: string): Promise<void>;
  startVM(node: NodeTarget, ref: string): Promise<ProviderInstanceState>;
  stopVM(node: NodeTarget, ref: string, opts?: { force?: boolean }): Promise<ProviderInstanceState>;
  restartVM(node: NodeTarget, ref: string): Promise<ProviderInstanceState>;
  getVM(node: NodeTarget, ref: string): Promise<ProviderInstanceState | null>;
  listVM(node: NodeTarget): Promise<ProviderInstanceState[]>;
  cloneVM(node: NodeTarget, ref: string, newName: string): Promise<ProvisionResult>;
  resizeVM(node: NodeTarget, ref: string, res: { cpuCores: number; memoryMb: number }): Promise<void>;
  createSnapshot(node: NodeTarget, ref: string, name: string, opts?: { includeMemory?: boolean }): Promise<{ sizeGb: number }>;
  restoreSnapshot(node: NodeTarget, ref: string, snapshotName: string): Promise<void>;
  deleteSnapshot(node: NodeTarget, ref: string, snapshotName: string): Promise<void>;
  getConsole(node: NodeTarget, ref: string, type: InstanceType): Promise<ConsoleSession>;
  getMetrics(node: NodeTarget, ref: string, range: { from: number; to: number; stepMs: number }): Promise<MetricPoint[]>;
}

export class ProviderNotImplementedError extends Error {
  constructor(provider: ProviderKind, method: string) {
    super(`Provider "${provider}" has not implemented ${method}() yet.`);
    this.name = "ProviderNotImplementedError";
  }
}
