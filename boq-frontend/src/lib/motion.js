export const motionTimings = Object.freeze({
  micro: 0.2,
  ui: 0.35,
  page: 0.45,
  exit: 0.25,
  stagger: 0.05,
});

export const motionEase = Object.freeze({
  smooth: [0.22, 1, 0.36, 1],
  exit: [0.4, 0, 0.2, 1],
  spring: { type: 'spring', stiffness: 420, damping: 34 },
});

export const transitions = Object.freeze({
  micro: { duration: motionTimings.micro, ease: motionEase.smooth },
  ui: { duration: motionTimings.ui, ease: motionEase.smooth },
  page: { duration: motionTimings.page, ease: motionEase.smooth },
  exit: { duration: motionTimings.exit, ease: motionEase.exit },
});

export const pageVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: transitions.page },
  exit: { opacity: 0, y: -20, transition: transitions.exit },
};

export const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transitions.ui },
  exit: { opacity: 0, transition: transitions.exit },
};

export const sectionVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: transitions.ui },
  exit: { opacity: 0, y: -12, transition: transitions.exit },
};

export const panelVariants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: transitions.ui },
  exit: { opacity: 0, y: -10, transition: transitions.exit },
};

export const scaleInVariants = {
  initial: { opacity: 0, y: 18, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: transitions.ui },
  exit: { opacity: 0, y: 10, scale: 0.98, transition: transitions.exit },
};

export const listVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: motionTimings.stagger,
      delayChildren: 0.04,
    },
  },
};

export const listItemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: transitions.ui },
  exit: { opacity: 0, y: -8, transition: transitions.exit },
};

export const collapseVariants = {
  initial: { opacity: 0, height: 0 },
  animate: {
    opacity: 1,
    height: 'auto',
    transition: {
      height: { duration: motionTimings.ui, ease: motionEase.smooth },
      opacity: { duration: motionTimings.micro, ease: motionEase.smooth },
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      height: { duration: motionTimings.exit, ease: motionEase.exit },
      opacity: { duration: 0.16, ease: motionEase.exit },
    },
  },
};

export const notificationVariants = {
  initial: { opacity: 0, x: 100 },
  animate: { opacity: 1, x: 0, transition: transitions.ui },
  exit: { opacity: 0, x: 40, transition: transitions.exit },
};

export const buttonMotion = {
  whileHover: { scale: 1.03, y: -1 },
  whileTap: { scale: 0.97 },
  transition: transitions.micro,
};

export const subtleButtonMotion = {
  whileHover: { scale: 1.01, y: -1 },
  whileTap: { scale: 0.98 },
  transition: transitions.micro,
};

export const cardHoverMotion = {
  whileHover: {
    y: -4,
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
  },
  transition: transitions.ui,
};

export const iconHoverMotion = {
  whileHover: { rotate: 10, scale: 1.04 },
  transition: transitions.micro,
};

export const errorShakeAnimation = {
  x: [0, -5, 5, -4, 4, 0],
  transition: { duration: 0.32, ease: 'easeInOut' },
};
