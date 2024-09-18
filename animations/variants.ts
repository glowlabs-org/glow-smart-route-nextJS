import { Variants } from "framer-motion";

export const waitingToSuccessVariants: Variants = {
  hide: {
    opacity: 0.5,
  },
  show: {
    opacity: 1,
    transition: {
      duration: 1,
    },
  },
};

export const fadeInVariants: Variants = {
  hide: {
    opacity: 0,
  },
  show: {
    opacity: 1,

    transition: {
      duration: 1,
    },
  },
};

export const slideInLeftVariants: Variants = {
  hide: {
    opacity: 0,
    x: -300,
  },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 1,
    },
  },
};

export const slideInRightVariants: Variants = {
  hide: {
    opacity: 0,
    x: 300,
  },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 1,
    },
  },
};

export const slideInTopVariants: Variants = {
  hide: {
    opacity: 0,
    y: -200,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 1,
    },
  },
};

export const slideInBottomVariants: Variants = {
  hide: {
    opacity: 0,
    y: 500,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 1,
    },
  },
};
