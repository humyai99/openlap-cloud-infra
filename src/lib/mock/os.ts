import type { OsFamily } from "@/lib/types";

export const OS_CATALOG: Array<{ family: OsFamily; label: string; versions: string[]; color: string; initials: string }> = [
  { family: "ubuntu", label: "Ubuntu", versions: ["24.04 LTS", "22.04 LTS", "20.04 LTS"], color: "#E95420", initials: "Ub" },
  { family: "debian", label: "Debian", versions: ["12 Bookworm", "11 Bullseye"], color: "#A80030", initials: "De" },
  { family: "rocky", label: "Rocky Linux", versions: ["9.4", "8.10"], color: "#10B981", initials: "Ro" },
  { family: "alma", label: "AlmaLinux", versions: ["9.4", "8.10"], color: "#0F4266", initials: "Al" },
  { family: "fedora", label: "Fedora", versions: ["40", "39"], color: "#51A2DA", initials: "Fe" },
  { family: "windows", label: "Windows", versions: ["Server 2022", "Server 2019", "11 Pro"], color: "#0078D4", initials: "Wi" },
  { family: "alpine", label: "Alpine", versions: ["3.20", "3.19"], color: "#0D597F", initials: "Ap" },
  { family: "custom", label: "Custom ISO", versions: ["Upload / select ISO"], color: "#64748B", initials: "ISO" },
];

export const osLabel = (f: OsFamily) => OS_CATALOG.find((o) => o.family === f)?.label ?? f;
