export interface PurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id?: string;
    name: string;
    image_url?: string;
    image?: string;
  };
  selectedVariation: { name: string } | null;
  currentPrice: number;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  currentStock: number | null;
  exceedsStock: boolean;
  userNote: string;
  onUserNoteChange: (note: string) => void;
  walletBalance: number;
  totalPrice: number;
  loading: boolean;
  onBuy: (donationAmount: number, discount?: number, appliedCouponId?: string, guestDetails?: GuestDetails) => void;
  flashSaleId?: string;
  isLoggedIn?: boolean;
}

export interface AppliedCoupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
}

export interface GuestDetails {
  name: string;
  email: string;
  phone: string;
}

export type PaymentStep = 'details' | 'method' | 'binance' | 'razorpay';

export const INR_TO_USD_RATE = 70;
export const BULK_THRESHOLD = 5;
export const BULK_DISCOUNT_PERCENT = 8;
