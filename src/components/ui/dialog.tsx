"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
}: {
  className?: string;
  children: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl focus:outline-none",
          className,
        )}
      >
        <D.Title className="pr-6 text-base font-semibold">{title}</D.Title>
        {description ? (
          <D.Description className="mt-1.5 text-sm text-muted-foreground">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">Dialog</D.Description>
        )}
        <div className="mt-5">{children}</div>
        <D.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
