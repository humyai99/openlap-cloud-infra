"use client";
import * as D from "@radix-ui/react-dialog";
import { Bell, KeyRound, LogOut, Menu, Moon, Search, Sun, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import type { Alert, Node } from "@/lib/types";
import { SidebarContent } from "./sidebar";

export function Topbar({ user, nodes, alerts, isRealProvider }: { user: { name: string; email: string }; nodes: Node[]; alerts: Alert[]; isRealProvider: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
      <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <D.Trigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </D.Trigger>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-black/60 lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 w-72 border-r bg-sidebar lg:hidden">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">Main navigation</D.Description>
            <SidebarContent nodes={nodes} onNavigate={() => setMobileOpen(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search VMs, containers, nodes…"
          aria-label="Search"
          className="h-9 w-full rounded-lg border bg-muted/40 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.currentTarget.value.trim()) router.push(`/vms?q=${encodeURIComponent(e.currentTarget.value.trim())}`);
          }}
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        {!isRealProvider && <span className="mr-2 hidden rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 sm:inline">
          Mock Provider
        </span>}
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Notifications (${alerts.length})`} className="relative">
              <Bell />
              {alerts.length > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72">
            <div className="px-2 py-1.5 text-xs font-semibold">Alerts</div>
            {alerts.length === 0 && <div className="px-2 pb-2 text-xs text-muted-foreground">No active alerts</div>}
            {alerts.map((a) => (
              <DropdownMenuItem key={a.id} asChild>
                <Link href="/monitoring" className="flex-col !items-start gap-0.5">
                  <span className="text-sm">
                    <span className={a.severity === "critical" ? "text-red-500" : "text-amber-500"}>●</span> {a.resource}
                  </span>
                  <span className="text-xs text-muted-foreground">{a.message}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 grid size-8 place-items-center rounded-full bg-muted text-xs font-semibold" aria-label="Account menu">
              {user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <div className="px-2 py-1.5">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account/password"><KeyRound /> Change password</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings"><User /> Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                await fetch("/api/v1/auth/logout", { method: "POST" });
                router.replace("/login");
                router.refresh();
              }}
            >
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
