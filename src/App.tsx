import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppSettingsProvider, useAppSettingsContext } from "@/contexts/AppSettingsContext";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import AIChatWidget from "@/components/AIChatWidget";
import Index from "./pages/Index";
import { Construction, Settings } from "lucide-react";

// Lazy load all pages except Index
const AuthPage = lazy(() => import("./pages/AuthPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ProfileEditPage = lazy(() => import("./pages/ProfileEditPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const NotificationHistoryPage = lazy(() => import("./pages/NotificationHistoryPage"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const ResalePurchasePage = lazy(() => import("./pages/ResalePurchasePage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

const IndexRedirect = () => {
  const { search, hash } = useLocation();

  return <Navigate to={{ pathname: "/", search, hash }} replace />;
};

// App Content with Settings Applied
const AppContent = () => {
  const { settings, loading: settingsLoading } = useAppSettingsContext();
  const { isAdmin, isTempAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (settings.app_name) {
      document.title = settings.app_name;
    }
  }, [settings.app_name]);

  // Show loading while auth or settings are loading
  if (authLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show maintenance screen for non-admin users when maintenance mode is ON
  if (settings.maintenance_mode && !(isAdmin || isTempAdmin)) {
    return <MaintenanceScreen />;
  }

  return (
    <>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
          <Routes>
            <Route path="/index" element={<IndexRedirect />} />
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
            <Route path="/cart" element={<CartPage />} />
            <Route path="/resale/:code" element={<ResalePurchasePage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <AuthProvider>
          <AppSettingsProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AppContent />
            </TooltipProvider>
          </AppSettingsProvider>
        </AuthProvider>
      </AppErrorBoundary>
    </QueryClientProvider>
  );
};

export default App;
