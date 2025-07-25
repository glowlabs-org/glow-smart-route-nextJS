"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProviderProps {
  children: React.ReactNode;
}

const TooltipProvider = ({ children }: TooltipProviderProps) => {
  return <>{children}</>;
};

interface TooltipProps {
  children: React.ReactNode;
}

const Tooltip = ({ children }: TooltipProps) => {
  return <>{children}</>;
};

interface TooltipTriggerProps {
  children: React.ReactNode;
  className?: string;
}

const TooltipTrigger = ({ children, className }: TooltipTriggerProps) => {
  return (
    <div className={cn("relative group inline-block", className)}>
      {children}
    </div>
  );
};

interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
}

const TooltipContent = ({ children, className }: TooltipContentProps) => {
  return (
    <div
      className={cn(
        "absolute z-50 mb-2 px-3 py-1.5 text-sm text-white bg-gray-900 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 bottom-full left-1/2 transform -translate-x-1/2 whitespace-nowrap",
        className
      )}
      role="tooltip"
    >
      {children}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
    </div>
  );
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
