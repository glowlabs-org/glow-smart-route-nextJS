"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

const Collapsible = ({
  open,
  onOpenChange,
  children,
  className,
}: CollapsibleProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open !== undefined ? open : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  return (
    <div className={cn("", className)} data-state={isOpen ? "open" : "closed"}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            ...child.props,
            isOpen,
            onOpenChange: handleOpenChange,
          } as any);
        }
        return child;
      })}
    </div>
  );
};

interface CollapsibleTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const CollapsibleTrigger = React.forwardRef<
  HTMLDivElement,
  CollapsibleTriggerProps
>(({ children, asChild, isOpen, onOpenChange, className, ...props }, ref) => {
  const handleClick = () => {
    if (onOpenChange) {
      onOpenChange(!isOpen);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...children.props,
      onClick: handleClick,
      ref,
    });
  }

  return (
    <div
      ref={ref}
      className={cn("cursor-pointer", className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </div>
  );
});
CollapsibleTrigger.displayName = "CollapsibleTrigger";

interface CollapsibleContentProps {
  children: React.ReactNode;
  isOpen?: boolean;
  className?: string;
}

const CollapsibleContent = ({
  children,
  isOpen,
  className,
}: CollapsibleContentProps) => {
  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-200",
        isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
        className
      )}
      data-state={isOpen ? "open" : "closed"}
    >
      <div className="pb-2">{children}</div>
    </div>
  );
};

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
