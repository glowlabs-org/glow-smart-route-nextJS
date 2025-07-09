import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

import React, { FC, useState, useEffect } from "react";

export const InstructionsDialog: FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <div className="grid grid-cols-1 py-8 gap-4">
          <h3 className="font-medium text-xl mb-2 text-center">
            Before buying GLOW, you should know some important things
          </h3>
          <Carousel setApi={setApi}>
            <CarouselContent>
              <CarouselItem>
                <p className="text-center font-light p-4">
                  You cannot trade USDC for GLOW directly. Instead you must
                  convert your USDC to USDG on a 1:1 basis. Then you can trade
                  USDG for GLOW, and you can trade GLOW for USDG.
                </p>
              </CarouselItem>
              <CarouselItem>
                <p className="text-center font-light p-4">
                  USDG is a wrapper token for USDC - think of it like a digital
                  receipt for your USDC. Each USDG represents exactly 1 USDC
                  held safely by the Glow foundation. You can redeem USDG back
                  to USDC at a 1:1 rate, but only when certain safety conditions
                  are met (like security systems being active). <br />
                  <a
                    href="https://glow.org/blog/usdg-redemption"
                    target="_blank"
                    className="underline text-glow-black"
                  >
                    Learn more about USDG redemptions
                  </a>
                </p>
              </CarouselItem>
              <CarouselItem>
                <p className="text-center font-light p-4">
                  While USDG redemptions are now available, they depend on the
                  protocol&apos;s safety systems being operational. If these
                  systems detect any issues, redemptions may be temporarily
                  paused to protect users. This ensures your funds remain secure
                  even during unexpected situations.
                </p>
              </CarouselItem>
            </CarouselContent>
            <div className="flex items-center justify-between mt-4">
              <CarouselPrevious />
              {current === count ? (
                <DialogClose>
                  <Button variant={"outline"}>Close</Button>
                </DialogClose>
              ) : (
                <CarouselNext />
              )}
            </div>
          </Carousel>
        </div>
      </DialogContent>
    </Dialog>
  );
};
