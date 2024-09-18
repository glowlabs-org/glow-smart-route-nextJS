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
                  USDG will be redeemable 1:1 for USDC after the guarded launch
                  has ended.USDG is not redeemable for USDC during the guarded
                  launch. <br />
                  Read more about the guarded launch{" "}
                  <a
                    href="https://glowlabs.org/blog/glow-guarded-launch"
                    target="_blank"
                    className="underline text-white"
                  >
                    here
                  </a>
                </p>
              </CarouselItem>
              <CarouselItem>
                <p className="text-center font-light p-4">
                  Any USDC you move into the Glow ecosystem will need to remain
                  in the Glow ecosystem until the guarded launch ends. You will
                  be able to sell GLOW for USDG, but you will not be able to
                  convert USDG back to USDC.
                </p>
              </CarouselItem>
              <CarouselItem>
                <p className="text-center font-light p-4">
                  Impact Points are Glow&apos;s version of carbon credits.
                  Buying impact points directly contributes to helping the
                  environment by incentivizing new solar farms. Impact points
                  cannot be transferred or sold. <br />
                  Read more about the glow impact platform{" "}
                  <a
                    href="https://glowlabs.org/blog/glow-impact-platform"
                    target="_blank"
                    className="underline text-white"
                  >
                    here
                  </a>
                </p>
              </CarouselItem>
            </CarouselContent>
            <div className="flex items-center justify-between mt-4">
              <CarouselPrevious />
              {current === count ? (
                <DialogClose>
                  <Button variant={"glass-outline"}>Close</Button>
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
