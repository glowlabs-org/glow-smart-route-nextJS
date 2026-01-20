"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import QRCode from "react-qr-code";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
}

export function QRCodeDialog({
  open,
  onOpenChange,
  url,
  title = "Scan to Join",
}: QRCodeDialogProps) {
  const svgRef = React.useRef<HTMLDivElement>(null);

  const copyLink = React.useCallback(() => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  }, [url]);

  const downloadQR = React.useCallback(() => {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;

    // Convert SVG to canvas and download
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    canvas.width = 400;
    canvas.height = 400;

    img.onload = () => {
      if (!ctx) return;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 0, 0, 400, 400);

      const link = document.createElement("a");
      link.download = "glow-referral-qr.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("QR code downloaded!");
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  }, []);

  // Extract code from URL for display
  const code = url.split("/r/")[1] || url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px] p-0 gap-0 overflow-hidden rounded-[24px]">
        <div className="relative bg-background p-6 text-center space-y-4">
          <div className="relative z-10 space-y-4">
            <DialogTitle className="text-lg font-bold">{title}</DialogTitle>

            {/* QR Code Container */}
            <div
              ref={svgRef}
              className="relative mx-auto p-4 bg-white rounded-2xl border border-border w-fit"
            >
              <QRCode
                value={url}
                size={200}
                bgColor="white"
                fgColor="#111827"
                style={{ height: "200px", width: "200px" }}
                className="rounded-xl"
              />
            </div>

            {/* Code display */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Your Referral Code
              </p>
              <p className="text-lg font-mono font-bold text-foreground">
                {code}
              </p>
            </div>

            {/* URL display */}
            <div className="px-4 py-2.5 rounded-xl bg-muted/50 border">
              <p className="text-xs font-mono text-muted-foreground truncate">
                {url}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-muted/20 border-t flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={copyLink}
          >
            <Copy className="w-4 h-4" />
            Copy Link
          </Button>
          <Button
            className="flex-1"
            onClick={downloadQR}
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
