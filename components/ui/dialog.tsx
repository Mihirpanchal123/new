"use client";

import { AnimatePresence, motion } from "motion/react";
import { Dialog as RadixDialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Prevent closing by clicking outside / Esc (for decisions). */
  modal?: boolean;
  className?: string;
}

/** Accessible (Radix: focus trap, Esc, aria) + animated (Motion) dialog. */
export function Dialog({ open, onOpenChange, title, description, children, className, modal = false }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content
              asChild
              forceMount
              onInteractOutside={modal ? (e) => e.preventDefault() : undefined}
              onEscapeKeyDown={modal ? (e) => e.preventDefault() : undefined}
            >
              <motion.div
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2",
                  "rounded-[1.5rem] border border-border bg-surface p-6 shadow-pop focus:outline-none",
                  className,
                )}
                initial={{ opacity: 0, scale: 0.92, y: "-46%", x: "-50%" }}
                animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
                exit={{ opacity: 0, scale: 0.95, y: "-48%", x: "-50%" }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
              >
                <RadixDialog.Title className="font-display text-2xl font-semibold">{title}</RadixDialog.Title>
                {description ? (
                  <RadixDialog.Description className="mt-1.5 text-muted">{description}</RadixDialog.Description>
                ) : (
                  <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
                )}
                {children && <div className="mt-5">{children}</div>}
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}
