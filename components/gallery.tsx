"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel-v2";

export interface Gallery4Item {
  id: string;
  title: string;
  description: string;
  href: string;
  image: string;
}

export interface Region {
  code: string;
  name: string;
  description: string;
  status: "active" | "kickstarting" | "empty" | "failed";
  campaignId?: string;
  gctlStaked: number;
  farms: number;
  installers: number;
  deadline?: string;
  thumbnailUrl?: string;
}

export interface Gallery4Props {
  items?: Gallery4Item[];
  regions?: Region[];
  title: string;
  description: string;
}

// Function to generate gradient based on region name and status
const generateGradient = (regionName: string, status: Region["status"]) => {
  // Glow brand colors
  const colors = {
    yellow: "#f7fcc4",
    green: "#ccffd4",
    purple: "#dcc4ff",
  };

  // Generate hash from region name to ensure consistency
  const hash = regionName.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  // Select color combination based on hash
  const colorCombinations = [
    [colors.yellow, colors.green, colors.purple], // Main glow gradient
    [colors.green, colors.purple], // Gradient A style
    [colors.yellow, colors.green], // Gradient B style
    [colors.purple, colors.yellow], // Gradient C style
  ];

  const selectedColors =
    colorCombinations[Math.abs(hash) % colorCombinations.length];

  // Determine orientation based on status and region
  let angle = 111.06; // Default angle
  switch (status) {
    case "active":
      angle = 45 + (Math.abs(hash) % 90); // 45-135 degrees
      break;
    case "kickstarting":
      angle = 135 + (Math.abs(hash) % 90); // 135-225 degrees
      break;
    case "empty":
      angle = 225 + (Math.abs(hash) % 90); // 225-315 degrees
      break;
    case "failed":
      angle = 315 + (Math.abs(hash) % 90); // 315-45 degrees
      break;
  }

  // Create gradient string
  if (selectedColors.length === 3) {
    return `linear-gradient(${angle}deg, ${selectedColors[0]} 12.01%, ${selectedColors[1]} 39.47%, ${selectedColors[2]} 93.61%)`;
  } else {
    return `linear-gradient(${angle}deg, ${selectedColors[0]} 12.01%, ${selectedColors[1]} 93.61%)`;
  }
};

const Gallery = ({
  title,
  description,
  items = [],
  regions,
}: Gallery4Props) => {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Transform regions to gallery items if regions are provided
  const galleryItems = regions
    ? regions.map((region): Gallery4Item => {
        const getHref = () => {
          if (region.status === "active") {
            return `/regions/${region.code}`;
          } else if (region.status === "kickstarting" && region.campaignId) {
            return `/regions/${region.code}/campaign/${region.campaignId}`;
          }
          return `/regions/${region.code}/new`;
        };

        return {
          id: region.code,
          title: region.name,
          description: region.description,
          href: getHref(),
          image: "", // Not used anymore
        };
      })
    : items;

  useEffect(() => {
    if (!carouselApi) {
      return;
    }
    const updateSelection = () => {
      setCanScrollPrev(carouselApi.canScrollPrev());
      setCanScrollNext(carouselApi.canScrollNext());
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };
    updateSelection();
    carouselApi.on("select", updateSelection);
    return () => {
      carouselApi.off("select", updateSelection);
    };
  }, [carouselApi]);

  return (
    <section className={"py-8"}>
      <div className="container mx-auto">
        {(title || description) && (
          <div className="mb-8 flex items-end justify-between md:mb-14 lg:mb-16">
            <div className="flex flex-col gap-4">
              {title && <h2 className="glow-subhead text-3xl">{title}</h2>}
              {description && (
                <p className="max-w-lg text-muted-foreground">{description}</p>
              )}
            </div>
            <div className="hidden shrink-0 gap-2 md:flex">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  carouselApi?.scrollPrev();
                }}
                disabled={!canScrollPrev}
                className="disabled:pointer-events-auto"
              >
                <ArrowLeft className="size-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  carouselApi?.scrollNext();
                }}
                disabled={!canScrollNext}
                className="disabled:pointer-events-auto"
              >
                <ArrowRight className="size-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="w-full">
        <Carousel
          setApi={setCarouselApi}
          opts={{
            breakpoints: {
              "(max-width: 768px)": {
                dragFree: true,
              },
            },
          }}
        >
          <CarouselContent className="ml-0">
            {galleryItems.map((item, index) => {
              // Get the corresponding region for gradient generation
              const region = regions?.[index];
              const gradientStyle = region
                ? { background: generateGradient(region.name, region.status) }
                : {
                    background:
                      "linear-gradient(111.06deg, #f7fcc4 12.01%, #ccffd4 39.47%, #dcc4ff 93.61%)",
                  };

              return (
                <CarouselItem
                  key={item.id}
                  className="max-w-[320px] pl-[20px] lg:max-w-[360px] xl:max-w-[400px]"
                >
                  <a href={item.href} className="group rounded-xl">
                    <div className="group relative h-full min-h-[27rem] max-w-full overflow-hidden rounded-xl md:aspect-[5/4] lg:aspect-[16/9] xl:aspect-[16/10]">
                      {/* Dynamic gradient background */}
                      <div
                        className="absolute h-full w-full transition-transform duration-300 group-hover:scale-105"
                        style={gradientStyle}
                      />
                      <div className="absolute inset-0 h-full bg-[linear-gradient(hsl(var(--primary)/0),hsl(var(--primary)/0.2),hsl(var(--primary)/0.7)_100%)] mix-blend-multiply" />

                      {/* Content container - full height with flex layout */}
                      <div className="absolute inset-0 flex flex-col text-glow-black">
                        {/* Top section - Status badge */}
                        {region && (
                          <div className="flex justify-start p-6 md:p-8">
                            <span className="glow-eyebrow px-3 py-1 rounded-full text-glow-black border border-glow-black">
                              {region.status}
                            </span>
                          </div>
                        )}

                        {/* Middle section - Spacer to push content to bottom */}
                        <div className="flex-1" />

                        {/* Bottom section - Main content */}
                        <div className="flex flex-col items-start p-6 md:p-8 space-y-4">
                          {/* Region title */}
                          <h3 className="glow-subhead text-2xl md:text-3xl lg:text-4xl font-semibold">
                            {item.title}
                          </h3>

                          {/* Description */}
                          <div className="glow-body text-base md:text-lg opacity-90 line-clamp-3">
                            {item.description}
                          </div>

                          {/* Additional stats for regions */}
                          {region && region.status === "active" && (
                            <div className="flex flex-wrap gap-4 text-sm opacity-80">
                              <div className="glow-eyebrow text-xs">
                                {region.farms} Farms
                              </div>
                              <div className="glow-eyebrow text-xs">
                                {region.installers} Installers
                              </div>
                            </div>
                          )}

                          {region &&
                            region.status === "kickstarting" &&
                            region.deadline && (
                              <div className="glow-eyebrow text-xs opacity-80">
                                Deadline:{" "}
                                {new Date(region.deadline).toLocaleDateString()}
                              </div>
                            )}

                          {/* CTA */}
                          <div className="flex items-center glow-cta font-medium text-sm md:text-base pt-2 transition-transform group-hover:translate-x-1">
                            {regions ? "View Region" : "Read more"}
                            <ArrowRight className="ml-2 size-4 md:size-5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
        <div className="mt-8 flex justify-center gap-2">
          {galleryItems.map((_, index) => (
            <button
              key={index}
              className={`h-2 w-2 rounded-full transition-colors ${
                currentSlide === index ? "bg-primary" : "bg-primary/20"
              }`}
              onClick={() => carouselApi?.scrollTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export { Gallery };
