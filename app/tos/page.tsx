"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/header";
import { TRANSLATIONS } from "@/lib/i18n";

export default function TosPage() {
  // Keep the public legal terms in English to match the signed ToS text.
  const s = TRANSLATIONS.en.routes.tos;
  return (
    <>
      <Header withIsScrolled={false} />
      <div className="container mx-auto py-8 px-4 max-w-4xl pt-20">
        <Card className="p-0">
          <div className="px-6 py-6 border-b">
            <h1 className="text-3xl font-bold">{s.title}</h1>
            <p className="text-muted-foreground mt-2">
              {s.lastUpdated(new Date().toLocaleDateString("en-US"))}
            </p>
          </div>

          <ScrollArea className="h-[calc(100vh-250px)] px-6">
            <div className="space-y-6 py-6 text-sm">
              <div>
                <h3 className="font-semibold text-base mb-2">{s.sec1Title}</h3>
                <p className="text-muted-foreground mb-3">
                  {s.sec1Body1Part1}
                  <strong>app.glow.org</strong>
                  {s.sec1Body1Part2}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium">{s.sec1EligibilityLabel}</span>{" "}
                  {s.sec1EligibilityBody}
                </p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-base mb-2">{s.sec2Title}</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>{s.sec2Bullet1}</li>
                  <li>{s.sec2Bullet2}</li>
                </ul>

                <p className="text-muted-foreground mt-3">
                  <span className="font-medium">{s.sec2PrivacyLabel}</span>{" "}
                  {s.sec2PrivacyBody}
                </p>

                <p className="text-muted-foreground mt-3">
                  <span className="font-medium">{s.sec2ProhibitedLabel}</span>{" "}
                  {s.sec2ProhibitedBody}
                </p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-base mb-2">{s.sec3Title}</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>{s.sec3Bullet1}</li>
                  <li>{s.sec3Bullet2}</li>
                  <li>{s.sec3Bullet3}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-base mb-2">{s.sec4Title}</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>{s.sec4Bullet1}</li>
                  <li>{s.sec4Bullet2}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-base mb-2">{s.sec5Title}</h3>
                <p className="text-muted-foreground">{s.sec5Body}</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-base mb-2">{s.sec6Title}</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>{s.sec6Bullet1}</li>
                  <li>{s.sec6Bullet2}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-base mb-2">{s.sec7Title}</h3>
                <p className="text-muted-foreground">
                  {s.sec7BodyPart1}
                  <a
                    href="https://app.glow.org/tos"
                    className="text-primary underline hover:no-underline"
                  >
                    app.glow.org/tos
                  </a>
                  {s.sec7BodyPart2}
                </p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-base mb-2">{s.sec8Title}</h3>
                <p className="text-muted-foreground mb-3">{s.sec8Body1}</p>
                <p className="text-muted-foreground">
                  <span className="font-medium">{s.sec8SubmissionsLabel}</span>{" "}
                  {s.sec8SubmissionsBody}
                </p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-base mb-2">{s.sec9Title}</h3>
                <p className="text-muted-foreground">{s.sec9Body}</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-base mb-2">{s.sec10Title}</h3>
                <p className="text-muted-foreground">{s.sec10Body}</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-base mb-2">{s.sec11Title}</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>{s.sec11Bullet1}</li>
                  <li>{s.sec11Bullet2}</li>
                </ul>
              </div>

              <div className="pt-6 pb-2">
                <p className="text-muted-foreground font-medium">
                  {s.closingAcknowledgment}
                </p>
                <p className="text-muted-foreground mt-2">{s.closingContact}</p>
              </div>
            </div>
          </ScrollArea>
        </Card>
      </div>
    </>
  );
}
