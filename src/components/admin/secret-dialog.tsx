"use client";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Shows a secret (temporary password / API key) exactly once. */
export function SecretDialog({ secret, title, description, onClose }: { secret: string | null; title: string; description: string; onClose: () => void }) {
  return (
    <Dialog open={!!secret} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={title} description={description}>
        <div className="flex gap-2">
          <Input readOnly value={secret ?? ""} className="font-mono text-xs" aria-label="Secret" onFocus={(e) => e.currentTarget.select()} />
          <Button
            variant="outline"
            size="icon"
            aria-label="Copy"
            onClick={() => {
              void navigator.clipboard.writeText(secret ?? "");
              toast.success("Copied");
            }}
          >
            <Copy />
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Share it through a secure channel. It won&apos;t be shown again.</p>
        <div className="mt-4 flex justify-end">
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
