"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useLang } from "@/lib/i18n";

interface WidgetErrorBoundaryProps {
  children: React.ReactNode;
  fallbackClassName?: string;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function WidgetErrorFallback({
  fallbackClassName,
  onRetry,
}: {
  fallbackClassName?: string;
  onRetry: () => void;
}) {
  const { t } = useLang();
  const w = t.common.widgetErrorBoundary;
  return (
    <Card
      className={`bg-card border-border ${fallbackClassName ?? ""}`}
    >
      <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <AlertTriangle className="h-8 w-8 text-yellow-500" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {w.somethingWentWrong}
          </p>
          <p className="text-xs text-muted-foreground">
            {w.widgetEncounteredError}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-2"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {w.retry}
        </Button>
      </CardContent>
    </Card>
  );
}

export class WidgetErrorBoundary extends React.Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[WidgetErrorBoundary] Caught error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <WidgetErrorFallback
          fallbackClassName={this.props.fallbackClassName}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
