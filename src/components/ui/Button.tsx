import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 border border-white/25 hover:from-sky-400 hover:to-blue-500 active:scale-[0.98]",
        secondary:
          "bg-white/[0.08] hover:bg-white/[0.14] text-foreground border border-white/15 backdrop-blur-xl shadow-sm hover:border-white/25 active:scale-[0.98]",
        destructive:
          "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-500/25 border border-white/20 hover:from-rose-500 hover:to-red-500 active:scale-[0.98]",
        outline:
          "border border-white/15 bg-transparent hover:bg-white/[0.06] text-foreground backdrop-blur-md active:scale-[0.98]",
        ghost:
          "hover:bg-white/[0.08] text-foreground active:scale-[0.98]",
        glass:
          "bg-gradient-to-b from-white/[0.14] to-white/[0.03] text-foreground border border-white/20 backdrop-blur-2xl shadow-xl shadow-black/30 hover:border-white/35 active:scale-[0.98]",
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
