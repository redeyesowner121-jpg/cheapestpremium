import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import WalletPage from "./pages/WalletPage";
import OrdersPage from "./pages/OrdersPage";
import ProfilePage from "./pages/ProfilePage";
import ProfileEditPage from "./pages/ProfileEditPage";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ChatPage from "./pages/ChatPage";
import DirectMessagePage from "./pages/DirectMessagePage";
import UsersPage from "./pages/UsersPage";
import NotificationHistoryPage from "./pages/NotificationHistoryPage";
import AdminPage from "./pages/AdminPage";
import SellersPage from "./pages/SellersPage";
import SellerPanelPage from "./pages/SellerPanelPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/edit" element={<ProfileEditPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/product" element={<ProductDetailPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/dm/:userId" element={<DirectMessagePage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/notifications" element={<NotificationHistoryPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/sellers" element={<SellersPage />} />
            <Route path="/seller-panel" element={<SellerPanelPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
