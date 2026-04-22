import { useEffect, useState, lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppSettingsProvider, useAppSettingsContext } from "@/contexts/AppSettingsContext";
import AppErrorBoundary from "@/components/AppErrorBoundary";

import SubdomainLanding, { getSubdomainConfig } from "@/components/SubdomainLanding";
import { Construction, Settings } from "lucide-react";
import Index from "./pages/Index";

const AIChatWidget = lazy(() => import("@/components/AIChatWidget"));
const RecentOrderNotification = lazy(() => import("@/components/RecentOrderNotification"));

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
const ProductEditPage = lazy(() => import("./pages/ProductEditPage"));
const ProductEditListPage = lazy(() => import("./pages/ProductEditListPage"));
const AIPage = lazy(() => import("./pages/AIPage"));
const BinanceTestPage = lazy(() => import("./pages/BinanceTestPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Optimized QueryClient with aggressive caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

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
  const { settings } = useAppSettingsContext();
  const { isAdmin, isTempAdmin } = useAuth();

  useEffect(() => {
    if (settings.app_name) {
      document.title = settings.app_name;
    }
  }, [settings.app_name]);

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
            <Route path="/auth/telegram" element={<AuthPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/wallet/transactions" element={<TransactionsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/edit" element={<ProfileEditPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:slug" element={<ProductDetailPage />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/product" element={<ProductDetailPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/notifications" element={<NotificationHistoryPage />} />
            <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
            <Route path="/admin/:tab" element={<AdminPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/resale/:code" element={<ResalePurchasePage />} />
            <Route path="/edit" element={<ProductEditListPage />} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/edit/:slug" element={<ProductEditPage />} />
            <Route path="/test-binance" element={<BinanceTestPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Suspense fallback={null}>
          <RecentOrderNotification />
        </Suspense>
        <Suspense fallback={null}>
          <AIChatWidget />
        </Suspense>
      </BrowserRouter>
    </>
  );
};

const App = () => {
  // Check subdomain BEFORE rendering the full app
  const subdomainConfig = getSubdomainConfig();
  if (subdomainConfig) {
    return <SubdomainLanding config={subdomainConfig} />;
  }

  return (
    <HelmetProvider>
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
    </HelmetProvider>
  );
};

export default App;
