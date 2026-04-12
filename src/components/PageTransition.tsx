import React, { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Track navigation direction
let navigationDirection: 'forward' | 'back' = 'forward';
const historyStack: string[] = [];

export function trackNavigation(pathname: string) {
  const lastIndex = historyStack.lastIndexOf(pathname);
  if (lastIndex !== -1 && lastIndex < historyStack.length - 1) {
    // Going back to a previously visited page
    navigationDirection = 'back';
    historyStack.length = lastIndex + 1;
  } else {
    navigationDirection = 'forward';
    historyStack.push(pathname);
  }
  // Keep stack manageable
  if (historyStack.length > 50) historyStack.splice(0, 20);
}

const variants = {
  enter: (direction: 'forward' | 'back') => ({
    x: direction === 'forward' ? '30%' : '-30%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: 'forward' | 'back') => ({
    x: direction === 'forward' ? '-15%' : '15%',
    opacity: 0,
  }),
};

interface PageTransitionProps {
  children: React.ReactNode;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();
  const dirRef = useRef(navigationDirection);

  useEffect(() => {
    trackNavigation(location.pathname);
    dirRef.current = navigationDirection;
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait" initial={false} custom={dirRef.current}>
      <motion.div
        key={location.pathname}
        custom={dirRef.current}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{
          type: 'tween',
          ease: [0.25, 0.1, 0.25, 1],
          duration: 0.2,
        }}
        style={{ width: '100%', minHeight: '100vh' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;
