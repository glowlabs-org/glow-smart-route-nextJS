"use client";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Navbar } from "./navbar";

export const ScrollWrapper = ({ children }: any) => {
  // const containerRef = useRef<HTMLDivElement>(null);
  // const [hidden, setHidden] = useState(false);
  // const [scrolledAfterHero, setScrolledAfterHero] = useState(false);
  // let lastScrollY = 0; // Keep track of the last scroll position

  // useEffect(() => {
  //   const handleScroll = () => {
  //     const currentScrollY = window.scrollY;
  //     if (currentScrollY < lastScrollY) {
  //       // Scrolling up
  //       if (currentScrollY > 500) {
  //         setScrolledAfterHero(true);
  //       } else {
  //         setScrolledAfterHero(false);
  //         setHidden(false);
  //       }
  //     } else if (currentScrollY > 100 && currentScrollY > lastScrollY) {
  //       // Scrolling down
  //       if (currentScrollY <= 500) {
  //         setScrolledAfterHero(false);
  //       }
  //       setHidden(true);
  //     }
  //     lastScrollY = currentScrollY;
  //   };

  //   window.addEventListener("scroll", handleScroll);

  //   return () => window.removeEventListener("scroll", handleScroll);
  // }, []);

  return (
    <>
      <Navbar />
      {children}
    </>
  );
};
