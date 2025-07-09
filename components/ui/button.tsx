import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex glow-cta items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 active:scale-95 cursor-pointer border-0",
  {
    variants: {
      variant: {
        default: "glow-button",
        orange:
          "text-black font-semibold tracking-wide hover:scale-105 hover:-translate-y-0.5",
        success: "bg-green-600 text-white hover:bg-green-700",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "bg-background text-black border-2 border-glow-medium-grey hover:bg-foreground hover:text-background",
        "outline-white":
          "bg-transparent text-white border border-input hover:bg-white hover:text-black",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        "secondary-primary":
          "bg-foreground text-background hover:bg-foreground/90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
      },
      size: {
        default: "h-12 px-4 py-2",
        sm: "h-10 rounded-full px-3 text-xs",
        lg: "h-12 rounded-full px-6 text-base",
        xl: "h-16 rounded-full px-8 text-lg",
        icon: "h-10 w-10",
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
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    // Apply orange background for orange variant using exact brand color
    const orangeStyle =
      variant === "orange"
        ? {
            backgroundColor: "var(--color-glow-orange)",
          }
        : {};

    const buttonContent = (
      <>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </>
    );

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          style={orangeStyle}
          ref={ref}
          disabled={isLoading || disabled}
          {...props}
        >
          <span>{buttonContent}</span>
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        style={orangeStyle}
        ref={ref}
        disabled={isLoading || disabled}
        {...props}
      >
        {buttonContent}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
