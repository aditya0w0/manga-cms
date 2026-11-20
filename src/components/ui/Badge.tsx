import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium transition-colors border",
  {
    variants: {
      variant: {
        default:
          "bg-sky-500/10 text-sky-300 border-sky-500/25",
        secondary:
          "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
        destructive:
          "bg-rose-500/10 text-rose-300 border-rose-500/25",
        warning:
          "bg-amber-500/10 text-amber-300 border-amber-500/25",
        outline:
          "bg-slate-900/60 text-slate-300 border-slate-700",
        success:
          "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
        muted:
          "bg-slate-900 text-slate-400 border-slate-800",
        glass:
          "bg-slate-900/80 text-slate-300 border-slate-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
