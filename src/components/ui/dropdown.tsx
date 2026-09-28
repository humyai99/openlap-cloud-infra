"use client";
import * as M from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export function DropdownMenuContent({ className, ...p }: M.DropdownMenuContentProps) {
  return (
    <M.Portal>
      <M.Content sideOffset={6} align="end" className={cn("z-50 min-w-44 rounded-lg border bg-card p-1 shadow-lg", className)} {...p} />
    </M.Portal>
  );
}

export function DropdownMenuItem({ className, destructive, ...p }: M.DropdownMenuItemProps & { destructive?: boolean }) {
  return (
    <M.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[disabled]:opacity-40 [&_svg]:size-4 [&_svg]:text-muted-foreground",
        destructive && "text-red-500 [&_svg]:text-red-500",
        className,
      )}
      {...p}
    />
  );
}

export function DropdownMenuSeparator() {
  return <M.Separator className="my-1 h-px bg-border" />;
}
