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

export const stepEntryVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: delay * 0.08,
      duration: 0.3,
      ease: "easeOut",
    },
  }),
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
    },
  },
};

export const pulseGlowVariants: Variants = {
  idle: {
    scale: 1,
    opacity: 0.5,
  },
  pulse: {
    scale: [1, 1.15, 1],
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export const checkmarkDrawVariants: Variants = {
  hidden: {
    pathLength: 0,
    opacity: 0,
  },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.35, ease: "easeOut" },
      opacity: { duration: 0.1 },
    },
  },
};

export const timelineFillVariants: Variants = {
  empty: {
    scaleY: 0,
  },
  filled: {
    scaleY: 1,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

export const stepContentSlideVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -10,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    x: 10,
    transition: {
      duration: 0.2,
    },
  },
};

export const statusBadgeVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: {
      duration: 0.15,
    },
  },
};
