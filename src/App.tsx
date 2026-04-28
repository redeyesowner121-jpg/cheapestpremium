import { useEffect, useState, lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppSettingsProvider, useAppSettingsContext } from "@/contexts/AppSettingsContext";
import AppErrorBoundary from "@/components/AppErrorBoundary";

import SubdomainLanding, { getSubdomainConfig } from "@/components/SubdomainLanding";
import { Construction, Settings } from "lucide-react";
import Index from "./pages/Index";

const recoverFromChunkFailure = async () => {
  const key = "__lov_chunk_recovered__";
  const now = Date.now();

  try {
    const last = Number(sessionStorage.getItem(key) || "0");
    if (now - last < 60_000) return;
    sessionStorage.setItem(key, String(now));
  } catch {}

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((registrations || []).map((registration) => registration.unregister()));
  } catch {}

  try {
    const keys = await caches?.keys?.();
    await Promise.all((keys || []).map((cacheKey) => caches.delete(cacheKey)));
  } catch {}

  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(now));
  window.location.replace(url.toString());
};

const lazyWithRecovery = <T extends { default: React.ComponentType<any> }>(loader: () => Promise<T>) =>
  lazy(async () => {
    try {
      return await loader();
    } catch (error) {
      console.error("Lazy page failed to load, refreshing stale client cache:", error);
      await recoverFromChunkFailure();
      throw error;
    }
  });

const AIChatWidget = lazy(() =>
  new Promise<typeof import("@/components/AIChatWidget")>((resolve) => {
    const load = () => resolve(import("@/components/AIChatWidget"));
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      (window as any).requestIdleCallback(load, { timeout: 3000 });
    } else {
      setTimeout(load, 2000);
    }
  })
);
const RecentOrderNotification = lazy(() =>
  new Promise<typeof import("@/components/RecentOrderNotification")>((resolve) => {
    const load = () => resolve(import("@/components/RecentOrderNotification"));
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      (window as any).requestIdleCallback(load, { timeout: 3000 });
    } else {
      setTimeout(load, 1500);
    }
  })
);

// Lazy load all pages except Index
const AuthPage = lazyWithRecovery(() => import("./pages/AuthPage"));
const TelegramAuthPage = lazyWithRecovery(() => import("./pages/TelegramAuthPage"));
const WalletPage = lazyWithRecovery(() => import("./pages/WalletPage"));
const OrdersPage = lazyWithRecovery(() => import("./pages/OrdersPage"));
const ProfilePage = lazyWithRecovery(() => import("./pages/ProfilePage"));
const ProfileEditPage = lazyWithRecovery(() => import("./pages/ProfileEditPage"));
const ProductsPage = lazyWithRecovery(() => import("./pages/ProductsPage"));
const ProductDetailPage = lazyWithRecovery(() => import("./pages/ProductDetailPage"));
const ChatPage = lazyWithRecovery(() => import("./pages/ChatPage"));
const UsersPage = lazyWithRecovery(() => import("./pages/UsersPage"));
const NotificationHistoryPage = lazyWithRecovery(() => import("./pages/NotificationHistoryPage"));
const TransactionsPage = lazyWithRecovery(() => import("./pages/TransactionsPage"));
const AdminPage = lazyWithRecovery(() => import("./pages/AdminPage"));
const AdminEmailLogsPage = lazyWithRecovery(() => import("./pages/AdminEmailLogsPage"));
const AdminEscrowPage = lazyWithRecovery(() => import("./pages/AdminEscrowPage"));
const EscrowPage = lazyWithRecovery(() => import("./pages/EscrowPage"));
const CartPage = lazyWithRecovery(() => import("./pages/CartPage"));
const ResalePurchasePage = lazyWithRecovery(() => import("./pages/ResalePurchasePage"));
const TermsPage = lazyWithRecovery(() => import("./pages/TermsPage"));
const ProductEditPage = lazyWithRecovery(() => import("./pages/ProductEditPage"));
const ProductEditListPage = lazyWithRecovery(() => import("./pages/ProductEditListPage"));
const AIPage = lazyWithRecovery(() => import("./pages/AIPage"));
const BinanceTestPage = lazyWithRecovery(() => import("./pages/BinanceTestPage"));
const NotFound = lazyWithRecovery(() => import("./pages/NotFound"));

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

// App Content with Settings Applied
const AppContent = () => {
  const { settings } = useAppSettingsContext();
  const { isAdmin, isTempAdmin } = useAuth();

  useEffect(() => {
    if (settings.app_name) {
      document.title = settings.app_name;
    }
  }, [settings.app_name]);

  // Prefetch likely next routes during browser idle time for instant navigation.
  // Keep this list small — too many concurrent imports compete with critical data fetches.
  useEffect(() => {
    const prefetch = () => {
      import("./pages/ProductsPage");
      import("./pages/CartPage");
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = (window as any).requestIdleCallback(prefetch, { timeout: 6000 });
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const t = setTimeout(prefetch, 4000);
    return () => clearTimeout(t);
  }, []);

  if (settings.maintenance_mode && !(isAdmin || isTempAdmin)) {
    return <MaintenanceScreen />;
  }

  return (
    <>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
          <Routes>
            <Route path="/index" element={<Index />} />
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/telegram" element={<AuthPage />} />
            <Route path="/telegram/auth" element={<TelegramAuthPage />} />
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
            <Route path="/admin/email-logs" element={<AdminEmailLogsPage />} />
            <Route path="/admin/escrow" element={<AdminEscrowPage />} />
            <Route path="/escrow" element={<EscrowPage />} />
            <Route path="/escrow/:dealId" element={<EscrowPage />} />
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
    return <div data-app-ready="true"><SubdomainLanding config={subdomainConfig} /></div>;
  }

  return (
    <div data-app-ready="true">
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
    </div>
  );
};

export default App;
