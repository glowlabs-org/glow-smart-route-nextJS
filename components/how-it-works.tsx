import { MoveRight } from "lucide-react";
import React from "react";

import { GlowSymbol } from "./glow-symbol";

interface CasestudyItem {
  tags: string;
  title: string;
  subtitle: string;
  image: string;
  link?: string;
}

interface Casestudy5Props {
  featuredCasestudy: CasestudyItem;
}

export const HowItWorks = ({ featuredCasestudy }: Casestudy5Props) => {
  return (
    <section className="px-6 py-8 md:pb-16 lg:pb-24 xl:pb-32">
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto w-full">
        <div className="border border-border rounded-xl">
          <a
            href={featuredCasestudy.link || "#"}
            className="group grid gap-4 overflow-hidden px-6 transition-colors duration-500 ease-out hover:bg-muted/40 lg:grid-cols-2 xl:px-28"
          >
            <div className="flex flex-col justify-between gap-4 pt-8 md:pt-16 lg:pb-16">
              <div className="flex items-center justify-start gap-2 text-2xl font-medium">
                <GlowSymbol className="h-9 w-auto" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground sm:text-sm">
                  {featuredCasestudy.tags}
                </span>
                <h2 className="mt-4 mb-5 text-2xl font-semibold text-balance sm:text-3xl sm:leading-10">
                  {featuredCasestudy.title}
                  <span className="font-medium text-primary/50 transition-colors duration-500 ease-out group-hover:text-primary/70">
                    {" "}
                    {featuredCasestudy.subtitle}
                  </span>
                </h2>
                <div className="flex items-center gap-2 font-medium">
                  Read more
                  <MoveRight className="h-4 w-4 transition-transform duration-500 ease-out group-hover:translate-x-1" />
                </div>
              </div>
            </div>
            <div className="relative isolate py-8 md:py-16">
              <div className="relative isolate h-full border border-border bg-background p-2 rounded-2xl">
                <div className="h-full overflow-hidden">
                  <img
                    src={featuredCasestudy.image}
                    alt="placeholder"
                    className="aspect-[14/9] h-full w-full object-cover rounded-xl"
                  />
                </div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
};
