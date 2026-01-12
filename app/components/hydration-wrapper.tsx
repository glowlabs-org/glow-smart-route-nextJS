"use client";

import { HydrationBoundary, type DehydratedState } from "@tanstack/react-query";
import { ReactNode } from "react";

interface HydrationWrapperProps {
  children: ReactNode;
  state: DehydratedState;
}

export function HydrationWrapper({ children, state }: HydrationWrapperProps) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
