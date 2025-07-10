"use client";

import { Suspense, ReactNode } from "react";
import { Loading } from "@/components/loading";

interface PageWrapperProps {
  children: ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
