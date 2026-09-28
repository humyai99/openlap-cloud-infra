import { describe, expect, it } from "vitest";
import { createInstanceSchema, loginSchema, networkSchema, passwordSchema, quotaSchema, roleSchema } from "@/lib/validation/instance";

const base = {
  type: "vm", name: "ubuntu-web-01", projectId: "p", nodeId: "n", os: { family: "ubuntu", version: "24.04" },
  cpuCores: 2, memoryMb: 2048, diskGb: 20, diskType: "ssd", storagePoolId: "s", networkId: "net",
  vlanId: null, ipMode: "dhcp", firewallEnabled: true, sshKey: "",
};

describe("createInstanceSchema", () => {
  it("accepts a valid request", () => {
    expect(createInstanceSchema.safeParse(base).success).toBe(true);
  });

  it.each(["Ubuntu", "web_01", "-web", "web-", "a", "x".repeat(64), "web 01", "<script>"])("rejects hostname %j", (name) => {
    expect(createInstanceSchema.safeParse({ ...base, name }).success).toBe(false);
  });

  it("requires a static IP in static mode and validates it", () => {
    expect(createInstanceSchema.safeParse({ ...base, ipMode: "static" }).success).toBe(false);
    expect(createInstanceSchema.safeParse({ ...base, ipMode: "static", staticIp: "10.0.0.300" }).success).toBe(false);
    expect(createInstanceSchema.safeParse({ ...base, ipMode: "static", staticIp: "10.0.0.30/24" }).success).toBe(true);
  });

  it("bounds CPU / memory / VLAN", () => {
    expect(createInstanceSchema.safeParse({ ...base, cpuCores: 0 }).success).toBe(false);
    expect(createInstanceSchema.safeParse({ ...base, cpuCores: 2.5 }).success).toBe(false);
    expect(createInstanceSchema.safeParse({ ...base, memoryMb: 128 }).success).toBe(false);
    expect(createInstanceSchema.safeParse({ ...base, vlanId: 4095 }).success).toBe(false);
  });

  it("only accepts real SSH public keys", () => {
    expect(createInstanceSchema.safeParse({ ...base, sshKey: "hello" }).success).toBe(false);
    expect(createInstanceSchema.safeParse({ ...base, sshKey: "ssh-ed25519 AAAAC3Nza user@host" }).success).toBe(true);
  });
});

describe("other schemas", () => {
  it("login normalises the email", () => {
    expect(loginSchema.parse({ email: "  Admin@OpenLab.Local ", password: "12345678" }).email).toBe("admin@openlab.local");
  });

  it("password policy", () => {
    expect(passwordSchema.safeParse({ current: "x", next: "short1" }).success).toBe(false);
    expect(passwordSchema.safeParse({ current: "x", next: "onlyletterslong" }).success).toBe(false);
    expect(passwordSchema.safeParse({ current: "x", next: "letters-and-42-numbers" }).success).toBe(true);
  });

  it("network CIDR and gateway", () => {
    const n = { name: "lab-net", type: "bridge", bridge: "vmbr0", cidr: "10.10.0.0/24", gateway: "10.10.0.1", dhcpStart: "", dhcpEnd: "", vlanId: null, dns: [] };
    expect(networkSchema.safeParse(n).success).toBe(true);
    expect(networkSchema.safeParse({ ...n, cidr: "10.10.0.0/33" }).success).toBe(false);
    expect(networkSchema.safeParse({ ...n, gateway: "10.10.0" }).success).toBe(false);
  });

  it("quotas cannot be negative", () => {
    const q = { scope: "PROJECT", scopeId: "3f0b1e54-3e0e-4b9a-9d3c-1b1a1e1e1e1e", maxInstances: 1, maxCpuCores: 1, maxMemoryGb: 1, maxStorageGb: 1 };
    expect(quotaSchema.safeParse(q).success).toBe(true);
    expect(quotaSchema.safeParse({ ...q, maxCpuCores: -1 }).success).toBe(false);
  });

  it("roles only accept known permissions", () => {
    expect(roleSchema.safeParse({ name: "Ops", permissions: ["vm.start"] }).success).toBe(true);
    expect(roleSchema.safeParse({ name: "Ops", permissions: ["root.everything"] }).success).toBe(false);
  });
});
