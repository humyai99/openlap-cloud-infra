import {
  Archive,
  Boxes,
  Camera,
  Cloud,
  Database,
  Disc,
  FileText,
  Flame,
  Gauge,
  HardDrive,
  Image,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  Monitor,
  Network,
  ScrollText,
  Server,
  Settings,
  Shield,
  Split,
  Tags,
  Users,
  UsersRound,
  Waypoints,
  Zap,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Implemented in Phase 1; others render a "coming soon" page. */
  ready?: boolean;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { label: null, items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, ready: true }] },
  {
    label: "Infrastructure",
    items: [
      { label: "Virtual Machines", href: "/vms", icon: Monitor, ready: true },
      { label: "Containers", href: "/containers", icon: Boxes, ready: true },
      { label: "Nodes", href: "/nodes", icon: Server, ready: true },
      { label: "Clusters", href: "/clusters", icon: Cloud },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Images", href: "/images", icon: Image },
      { label: "ISO Library", href: "/iso", icon: Disc },
      { label: "Templates", href: "/templates", icon: LayoutTemplate },
      { label: "Snapshots", href: "/snapshots", icon: Camera },
    ],
  },
  {
    label: "Networking",
    items: [
      { label: "Networks", href: "/networks", icon: Network, ready: true },
      { label: "Bridges", href: "/bridges", icon: Split },
      { label: "VLANs", href: "/vlans", icon: Tags },
      { label: "IP Addresses", href: "/ip-addresses", icon: Waypoints },
      { label: "Firewall", href: "/firewall", icon: Flame, ready: true },
    ],
  },
  {
    label: "Storage",
    items: [
      { label: "Storage Pools", href: "/storage", icon: Database, ready: true },
      { label: "Volumes", href: "/volumes", icon: HardDrive },
      { label: "Backups", href: "/backups", icon: Archive },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { label: "Performance", href: "/monitoring", icon: Gauge, ready: true },
      { label: "Events", href: "/events", icon: Zap },
      { label: "Logs", href: "/logs", icon: FileText },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Users", href: "/users", icon: Users, ready: true },
      { label: "Teams", href: "/teams", icon: UsersRound },
      { label: "Roles", href: "/roles", icon: Shield },
      { label: "API Keys", href: "/api-keys", icon: KeyRound, ready: true },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Settings, ready: true },
      { label: "Audit Logs", href: "/audit-logs", icon: ScrollText, ready: true },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV.flatMap((g) => g.items);
