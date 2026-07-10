"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Minimal Sheet implementation using native HTML (no @radix-ui dependency).
// The Sheet panel renders as a fixed side panel; open/close is controlled externally.

type SheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
};

function Sheet({ open = true, children }: SheetProps) {
  if (!open) return null;
  return <>{children}</>;
}

type SheetContentProps = React.ComponentProps<"div"> & {
  side?: "left" | "right" | "top" | "bottom";
};

function SheetContent({ className, children, side = "right", ...props }: SheetContentProps) {
  return (
    <div
      data-slot="sheet-content"
      data-side={side}
      role="dialog"
      className={cn(
        "fixed inset-y-0 z-50 flex flex-col bg-background p-4 shadow-lg",
        side === "right" && "right-0",
        side === "left" && "left-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sheet-header" className={cn("flex flex-col gap-2", className)} {...props} />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="sheet-title"
      className={cn("text-base font-semibold", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter };
