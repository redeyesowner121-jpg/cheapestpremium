import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Home, ShoppingBag, Wallet, ClipboardList, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const TOUR_STORAGE_KEY = 'rkr_onboarding_completed';

interface TourStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight: string;
}

const tourSteps: TourStep[] = [
  {
    icon: <Home className="w-8 h-8" />,
    title: 'Welcome to RKR Premium!',
    description: 'Your one-stop destination for premium digital products at unbeatable prices.',
    highlight: 'home'
  },
  {
    icon: <ShoppingBag className="w-8 h-8" />,
    title: 'Browse Products',
    description: 'Explore our wide range of OTT subscriptions, courses, tools, and more. Use filters to find exactly what you need.',
    highlight: 'products'
  },
  {
    icon: <Wallet className="w-8 h-8" />,
    title: 'Wallet & Payments',
    description: 'Add money to your wallet easily via UPI or QR. Track your balance and transaction history in one place.',
    highlight: 'wallet'
  },
  {
    icon: <ClipboardList className="w-8 h-8" />,
    title: 'Track Your Orders',
    description: 'View all your purchases, download access links for digital products, and track order status in real-time.',
    highlight: 'orders'
  },
  {
    icon: <User className="w-8 h-8" />,
    title: 'Your Profile & Rewards',
    description: 'Earn rank points with deposits, unlock discounts, share your referral code, and claim daily bonuses!',
    highlight: 'profile'
  }
];

const hasCompletedTour = () => {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  } catch (error) {
    console.warn('Tour storage unavailable, skipping onboarding tour:', error);
    return true;
  }
};

const markTourCompleted = () => {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  } catch (error) {
    console.warn('Failed to persist onboarding tour state:', error);
  }
};

const OnboardingTour: React.FC = () => {
  const { profile, user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Never block the storefront automatically. The tour state is still kept,
    // but customers should always see products first instead of a full-screen overlay.
    if (!user || !profile || hasCompletedTour()) {
      return;
    }

    markTourCompleted();
  }, [user, profile]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeTour = () => {
    markTourCompleted();
    setIsVisible(false);
  };

  const handleSkip = () => {
    completeTour();
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-card rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="gradient-primary p-6 text-center relative">
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="w-4 h-4 text-primary-foreground" />
            </button>
            
            <motion.div
              key={currentStep}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-16 h-16 mx-auto mb-3 bg-white/20 rounded-2xl flex items-center justify-center text-primary-foreground"
            >
              {step.icon}
            </motion.div>
            
            {isFirstStep && profile?.name && (
              <p className="text-primary-foreground/80 text-sm mb-1">
                Hey {profile.name.split(' ')[0]}! 👋
              </p>
            )}
            
            <motion.h2
              key={`title-${currentStep}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-xl font-bold text-primary-foreground"
            >
              {step.title}
            </motion.h2>
          </div>

          {/* Content */}
          <div className="p-6">
            <motion.p
              key={`desc-${currentStep}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-muted-foreground text-center leading-relaxed"
            >
              {step.description}
            </motion.p>

            {/* Step Indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {tourSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentStep
                      ? 'bg-primary w-6'
                      : 'bg-muted hover:bg-muted-foreground/50'
                  }`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-3 mt-6">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  className="flex-1 rounded-xl"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                className="flex-1 btn-gradient rounded-xl"
              >
                {isLastStep ? (
                  "Let's Go!"
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>

            {/* Skip Link */}
            <button
              onClick={handleSkip}
              className="w-full text-center text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors"
            >
              Skip tour
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingTour;
