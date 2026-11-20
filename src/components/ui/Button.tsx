import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-slate-100 hover:bg-white text-slate-950 font-bold shadow-lg shadow-black/25 border border-white/80 active:scale-[0.98]",
        secondary:
          "bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 hover:text-white border border-white/15 backdrop-blur-xl shadow-sm hover:border-white/25 active:scale-[0.98]",
        destructive:
          "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30 border border-rose-400/30 active:scale-[0.98]",
        outline:
          "border border-white/15 bg-transparent hover:bg-white/[0.06] text-foreground backdrop-blur-md active:scale-[0.98]",
        ghost:
          "hover:bg-white/[0.08] text-foreground active:scale-[0.98]",
        glass:
          "bg-white/[0.10] hover:bg-white/[0.18] text-white border border-white/20 backdrop-blur-2xl shadow-xl shadow-black/30 hover:border-white/35 active:scale-[0.98]",
        link:
          "text-sky-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 text-xs",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-7 text-sm font-bold",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
