"use client";
import React from "react";
import { Header } from "@/components/header";

import { ClaimsPanelMock } from "./claims-panel-mock";

export default function ClaimsTestView() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 xl:px-16 py-6 md:py-24 pt-20">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Claims Panel Test Environment
          </h1>
          <p className="text-muted-foreground text-base mb-6">
            Test the claims UI with mock data and functions
          </p>
        </div>

        {/* Use the mocked ClaimsPanel component */}
        <ClaimsPanelMock />
      </div>
    </div>
  );
}
