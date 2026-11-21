"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, children, className }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Liquid Glass Translucent Optical Backdrop */}
      <div
        className="fixed inset-0 bg-[#06080D]/60 backdrop-blur-md animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />
      {/* Atmospheric Backlight: Shines behind the elevated liquid glass to illuminate optical refraction */}
      <div
        className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-4 overflow-hidden"
        aria-hidden="true"
      >
        <div className="w-[560px] h-[440px] rounded-full bg-gradient-to-tr from-blue-600/25 via-indigo-500/15 to-transparent blur-3xl opacity-75" />
      </div>
      {/* Dialog content wrapper */}
      <div className={cn("relative z-50 w-full max-w-lg rounded-3xl liquid-glass-elevated border border-white/25 p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto", className)}>
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-colors focus:outline-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-left mb-4", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-bold leading-none tracking-tight text-foreground", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center justify-end gap-2 mt-6 pt-3 border-t border-white/10", className)} {...props} />;
}
