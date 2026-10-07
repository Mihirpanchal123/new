"use client";

import { LoaderCircle } from "lucide-react";
import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef, type ReactNode } from "react";
import { haptics } from "@/lib/haptics";
import { sound } from "@/lib/sound/sound-manager";
import { cn } from "@/lib/utils";

const VARIANTS = {
  // Tactile "pressable" buttons: a solid base edge that compresses on press.
  primary:
    "bg-brand text-brand-ink shadow-[0_4px_0_0_var(--brand-deep)] hover:brightness-110 active:shadow-[0_1px_0_0_var(--brand-deep)] active:translate-y-[3px]",
  success:
    "bg-success text-white shadow-[0_4px_0_0_var(--success-deep)] hover:brightness-110 active:shadow-[0_1px_0_0_var(--success-deep)] active:translate-y-[3px]",
  hint:
    "bg-hint-soft text-hint border-2 border-hint/40 hover:bg-hint/20 active:translate-y-[2px] dark:text-hint-bright",
  secondary:
    "bg-surface text-ink border-2 border-border shadow-[0_3px_0_0_var(--border)] hover:border-border-strong active:shadow-none active:translate-y-[3px]",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger:
    "bg-danger-soft text-danger border-2 border-danger/30 hover:bg-danger/15 active:translate-y-[2px]",
} as const;

const SIZES = {
  sm: "h-9 px-3.5 text-sm rounded-xl gap-1.5",
  md: "h-12 px-5 text-base rounded-2xl gap-2",
  lg: "h-14 px-6 text-lg rounded-2xl gap-2.5",
  xl: "h-16 px-8 text-xl rounded-[1.25rem] gap-3",
  icon: "h-11 w-11 rounded-2xl",
} as const;

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
  loadingText?: string;
  /** Tap sound + haptic. On by default. */
  feedback?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, loadingText, feedback = true, className, children, disabled, onClick, type = "button", ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (feedback) {
          sound.playClick();
          haptics.tap();
        }
        onClick?.(e);
      }}
      className={cn(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap font-display font-semibold tracking-tight",
        "transition-[transform,box-shadow,filter,background-color,border-color] duration-100",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <LoaderCircle className="size-[1.1em] animate-spin" aria-hidden />
          {loadingText ? <span>{loadingText}</span> : <span className="sr-only">Loading</span>}
        </>
      ) : (
        children
      )}
    </motion.button>
  );
});
