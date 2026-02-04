import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import SplashScreen from "@/components/SplashScreen";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import WalletPage from "./pages/WalletPage";
import OrdersPage from "./pages/OrdersPage";
import ProfilePage from "./pages/ProfilePage";
import ProfileEditPage from "./pages/ProfileEditPage";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ChatPage from "./pages/ChatPage";
import UsersPage from "./pages/UsersPage";
import NotificationHistoryPage from "./pages/NotificationHistoryPage";
import TransactionsPage from "./pages/TransactionsPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";
import { Construction, Settings } from "lucide-react";

const queryClient = new QueryClient();

// Maintenance Mode Screen
const MaintenanceScreen = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <Construction className="w-12 h-12 text-primary animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Under Maintenance</h1>
        <p className="text-muted-foreground">
          We're currently performing some updates to improve your experience. 
          Please check back soon!
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Settings className="w-4 h-4 animate-spin" />
          <span>Working on it...</span>
        </div>
      </div>
    </div>
  );
};

// App Content with Settings Applied
const AppContent = () => {
  const { settings, loading: settingsLoading } = useAppSettings();
  const { user, isAdmin, isTempAdmin } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [hasShownSplash, setHasShownSplash] = useState(false);

  useEffect(() => {
    // Check if splash was already shown in this session
    const splashShown = sessionStorage.getItem('splashShown');
    if (splashShown) {
      setShowSplash(false);
      setHasShownSplash(true);
    }
  }, []);

  useEffect(() => {
    // Update document title with app name
    if (settings.app_name) {
      document.title = settings.app_name;
    }
  }, [settings.app_name]);

  const handleSplashComplete = () => {
    setShowSplash(false);
    setHasShownSplash(true);
    sessionStorage.setItem('splashShown', 'true');
  };

  // Show maintenance screen for non-admin users when maintenance mode is ON
  if (!settingsLoading && settings.maintenance_mode && !(isAdmin || isTempAdmin)) {
    return <MaintenanceScreen />;
  }

  return (
    <>
      {showSplash && !hasShownSplash && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/wallet/transactions" element={<TransactionsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<ProfileEditPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/product" element={<ProductDetailPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/notifications" element={<NotificationHistoryPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppContent />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
