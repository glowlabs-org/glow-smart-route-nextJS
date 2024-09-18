"use client";

import { ConnectButton } from "@/components/connect-button";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/sheet";

export const Navbar = () => {
  return (
    <nav className="fixed top-0 border-b border-b-[#FFFFFF98] w-full h-18 pb-2 z-50 bg-secondary">
      <div className="border-b border-b-[#FFFFFF98]">
        <div className="max-w-[2000px] mx-auto flex md:justify-between items-center">
          <div className="text-xl px-10">
            <Image src="/logo.png" alt="Glow Logo" width={50} height={50} />
          </div>
          <div className="ml-auto md:space-x-16 text-white flex items-center font-light uppercase text-lg">
            <Link
              href="https://www.glow.org/#hero"
              target="_blank"
              className="hidden md:inline group transition duration-300"
            >
              Home
              <span className="block max-w-0 group-hover:max-w-full transition-all duration-500 h-0.5 bg-white"></span>
            </Link>

            {/* <Link
              href="https://www.glow.org/#contributors"
              className="hidden md:inline group transition duration-300"
            >
              Contributors
              <span className="block max-w-0 group-hover:max-w-full transition-all duration-500 h-0.5 bg-white"></span>
            </Link> */}
            <div className="border-l pl-2 border-[#E2E2E2]">
              <div className="border-l px-6 md:px-12 border-[#E2E2E2] py-4 flex justify-center items-center">
                <ConnectButton className="hidden md:block" variant="outline" />
                <Sheet>
                  <SheetTrigger asChild>
                    <Button className="md:hidden h-10" variant={"outline"}>
                      <Menu />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side={"right"}
                    className="sm:max-w-xl w-full px-0"
                  >
                    <div className="text-2xl font-medium grid grid-cols-1 gap-6 mt-4 p-8 text-secondary">
                      <div className="text-xl ">
                        <Image
                          src="/logo.png"
                          alt="Glow Logo"
                          width={50}
                          height={50}
                        />
                      </div>
                      <Link href="https://www.glow.org/#hero">Home</Link>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
