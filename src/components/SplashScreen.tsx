import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import appLogo from '@/assets/app-logo.jpg';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showText, setShowText] = useState(false);
  const [showTagline, setShowTagline] = useState(false);

  const appName = "RKR Premium Store";
  const tagline = "Premium Digital Products";

  useEffect(() => {
    // Sequence the animations
    const textTimer = setTimeout(() => setShowText(true), 600);
    const taglineTimer = setTimeout(() => setShowTagline(true), 1200);
    const exitTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 600);
    }, 2500);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(taglineTimer);
      clearTimeout(exitTimer);
    };
  }, [onComplete]);

  // Letter animation variants
  const letterVariants = {
    hidden: { opacity: 0, y: 50, rotateX: -90 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.5,
        ease: [0.6, -0.05, 0.01, 0.99] as [number, number, number, number]
      }
    })
  };

  // Tagline word animation
  const wordVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.15,
        duration: 0.4,
        ease: "easeOut" as const
      }
    })
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            scale: 1.1,
            filter: "blur(10px)"
          }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Animated Background */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/20"
          />
          
          {/* Floating Particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                opacity: 0, 
                scale: 0,
                x: Math.random() * 200 - 100,
                y: Math.random() * 200 - 100
              }}
              animate={{ 
                opacity: [0, 0.3, 0],
                scale: [0, 1, 0.5],
                x: Math.random() * 400 - 200,
                y: Math.random() * 400 - 200
              }}
              transition={{
                duration: 3,
                delay: i * 0.3,
                repeat: Infinity,
                repeatType: "loop"
              }}
              className="absolute w-4 h-4 rounded-full bg-primary/30 blur-sm"
            />
          ))}

          {/* Logo Container */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 150,
              damping: 15,
              duration: 1
            }}
            className="relative z-10"
          >
            {/* Outer Glow Ring */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ 
                opacity: [0, 0.6, 0.3],
                scale: [0.8, 1.3, 1.2],
                rotate: [0, 180, 360]
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                repeatType: "reverse",
                ease: "easeInOut"
              }}
              className="absolute -inset-6 rounded-full bg-gradient-to-r from-primary/40 via-accent/30 to-primary/40 blur-2xl"
            />
            
            {/* Inner Glow */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -inset-3 rounded-3xl bg-primary/20 blur-xl"
            />
            
            {/* Logo Image */}
            <motion.div
              className="relative"
              whileHover={{ scale: 1.05 }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="w-32 h-32 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-primary/20"
              >
                <img
                  src={appLogo}
                  alt="App Logo"
                  className="w-full h-full object-cover"
                />
              </motion.div>
              
              {/* Shine Effect */}
              <motion.div
                initial={{ x: "-100%", opacity: 0 }}
                animate={{ x: "200%", opacity: [0, 1, 0] }}
                transition={{ delay: 0.8, duration: 1, ease: "easeInOut" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
              />
            </motion.div>
          </motion.div>

          {/* Animated App Name - Letter by Letter */}
          <div className="mt-8 relative z-10 overflow-hidden">
            {showText && (
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-3xl font-bold text-foreground flex"
              >
                {appName.split('').map((letter, i) => (
                  <motion.span
                    key={i}
                    custom={i}
                    variants={letterVariants}
                    initial="hidden"
                    animate="visible"
                    className={letter === ' ' ? 'w-2' : ''}
                    style={{ display: 'inline-block' }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </motion.h1>
            )}
          </div>

          {/* Animated Tagline - Word by Word */}
          <div className="mt-3 relative z-10 overflow-hidden h-6">
            {showTagline && (
              <motion.p className="text-sm text-muted-foreground flex gap-1.5">
                {tagline.split(' ').map((word, i) => (
                  <motion.span
                    key={i}
                    custom={i}
                    variants={wordVariants}
                    initial="hidden"
                    animate="visible"
                    className="inline-block"
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.p>
            )}
          </div>

          {/* Loading Bar */}
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "120px" }}
            transition={{ delay: 1.5, duration: 0.3 }}
            className="mt-10 h-1 bg-muted rounded-full overflow-hidden relative z-10"
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ 
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent"
            />
          </motion.div>

          {/* Pulse Dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            className="mt-4 flex gap-2 relative z-10"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-primary"
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.4, 1, 0.4]
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.15
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
