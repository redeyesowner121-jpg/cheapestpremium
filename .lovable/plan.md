
# Wallet, Transactions, Purchase ও Refund সিস্টেমের সমস্যা এবং সমাধান

আমি কোডবেস পুঙ্খানুপুঙ্খভাবে বিশ্লেষণ করেছি এবং নিম্নলিখিত গুরুত্বপূর্ণ সমস্যাগুলি খুঁজে পেয়েছি:

---

## সমস্যা #1: Transaction Amount এ অসঙ্গতি (Critical Bug)

### সমস্যা:
তিনটি ভিন্ন জায়গায় purchase transaction তৈরি হচ্ছে ভিন্ন ভিন্ন ফর্ম্যাটে:

| Location | Amount Format | সমস্যা |
|----------|--------------|--------|
| `ProductDetailPage.tsx` (Line 242-248) | `amount: finalTotal` (positive) | ✗ ভুল - ব্যালেন্স কাটা হচ্ছে কিন্তু positive amount |
| `ProductsPage.tsx` (Line 267-273) | `amount: -totalPrice` (negative) | ✓ সঠিক |
| Database query results | Mixed: `0.00`, `29.00`, `15.00`, `69.00` | অসঙ্গতি |

**Database থেকে প্রমাণ:**
```
Purchase: YouTube Premium - amount: 0.00 (ভুল!)
Purchase: Netflix Premium 1 Month - amount: 69.00 (positive, অসঙ্গত)
Order refund - YouTube Premium - amount: 29.00 (positive, সঠিক)
```

### সমাধান:
`ProductDetailPage.tsx` এ purchase transaction amount নেগেটিভ হওয়া উচিত:
```typescript
// Before (ভুল)
amount: finalTotal

// After (সঠিক)
amount: -finalTotal
```

---

## সমস্যা #2: Admin Order Modal এ Refund Logic এ Discount Check নেই (Critical Bug)

### সমস্যা:
`OrderModal.tsx` এ admin যখন order cancel করে, তখন discount check করা হচ্ছে না। কিন্তু `useOrderActions.ts` এ সঠিকভাবে check আছে।

**OrderModal.tsx (Line 95-118):**
```typescript
// If cancelled/rejected, refund
if (status === 'cancelled' || status === 'refunded') {
  // ❌ hasDiscount check নেই - সবাইকে refund দিচ্ছে!
  const { data: userProfile } = await supabase...
  await supabase.from('profiles').update({
    wallet_balance: userProfile.wallet_balance + currentOrder.total_price
  })...
}
```

**useOrderActions.ts (Line 72-96) - সঠিক:**
```typescript
if (status === 'cancelled' || status === 'refunded') {
  const hasDiscount = (order.discount_applied || 0) > 0;
  if (!hasDiscount) {  // ✓ সঠিক check আছে
    // refund করা হচ্ছে
  }
}
```

### সমাধান:
`OrderModal.tsx` এ `hasDiscount` check যোগ করতে হবে এবং discount applied থাকলে notification message পরিবর্তন করতে হবে।

---

## সমস্যা #3: Admin Cancel করলে Notification এ ভুল Message

### সমস্যা:
Admin panel থেকে order cancel করলে notification সবসময় বলছে "Refund added to wallet" - এমনকি যখন discount ব্যবহার করা হয়েছে এবং refund দেওয়া হয়নি।

**OrderModal.tsx (Line 75-77):**
```typescript
case 'cancelled':
  notificationTitle = 'Order Cancelled ❌';
  notificationMessage = `...has been cancelled. Refund added to wallet.`;
  // ❌ সবসময় "Refund added" বলছে
```

### সমাধান:
Notification message এ condition যোগ করতে হবে - discount থাকলে ভিন্ন message দেখাবে।

---

## সমস্যা #4: Purchase Transaction এ Discount Record হচ্ছে না

### সমস্যা:
যখন user coupon ব্যবহার করে purchase করে, transaction description এ discount amount দেখা যাচ্ছে না।

**ProductDetailPage.tsx (Line 242-248):**
```typescript
await supabase.from('transactions').insert({
  user_id: user.id,
  type: 'purchase',
  amount: finalTotal,
  description: `Purchase: ${productName}${donationAmount > 0 ? ` + ₹${donationAmount} donation` : ''}`
  // ❌ discount info নেই
});
```

### সমাধান:
Description এ discount amount যোগ করতে হবে।

---

## সমস্যা #5: Duplicate Refund সম্ভব

### সমস্যা:
`OrdersPage.tsx` এবং `OrderModal.tsx`/`useOrderActions.ts` দুটোই independently refund করতে পারে। যদি admin এবং user একই সময়ে cancel করে, duplicate refund হতে পারে।

### সমাধান:
Order status check করার আগে fresh data fetch করা উচিত এবং optimistic concurrency control যোগ করা উচিত।

---

## সমস্যা #6: Transaction Amount Display Logic অসঙ্গত

### সমস্যা:
`WalletPage.tsx` এ purchase amount positive রাখা হচ্ছে কিন্তু `ProductsPage.tsx` এ negative। Display logic শুধু sign check করছে:

```typescript
// Line 704
<p className={`font-bold ${txn.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
  {txn.amount >= 0 ? '+' : ''}₹{Math.abs(txn.amount)}
</p>
```

এর মানে purchase দেখাচ্ছে green (+) sign এ যখন টাকা কাটা হয়েছে!

---

## Implementation Plan

### ধাপ ১: ProductDetailPage.tsx ঠিক করা
- Purchase transaction amount negative করা
- Description এ discount info যোগ করা

### ধাপ ২: OrderModal.tsx ঠিক করা
- `hasDiscount` check যোগ করা
- Notification message সঠিক করা
- Order status re-check করা before refund

### ধাপ ৩: Transaction Display উন্নত করা
- Type-based display logic যোগ করা
- Purchase সবসময় red (টাকা কাটা)
- Deposit/Refund সবসময় green (টাকা যোগ)

### ধাপ ৪: Race Condition Prevention
- Optimistic lock যোগ করা order update এ

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/ProductDetailPage.tsx` | Fix transaction amount sign, add discount to description |
| `src/components/admin/modals/OrderModal.tsx` | Add hasDiscount check, fix notification messages |
| `src/pages/WalletPage.tsx` | Fix transaction display based on type |
| `src/components/wallet/TransactionList.tsx` | Fix transaction display based on type |
| `src/pages/OrdersPage.tsx` | Add order status re-check before cancel |

---

## Technical Implementation Details

### Fix 1: ProductDetailPage.tsx Transaction Amount

```typescript
// Line 242-248 - Change from:
await supabase.from('transactions').insert({
  user_id: user.id,
  type: 'purchase',
  amount: finalTotal,  // ❌ positive
  status: 'completed',
  description: `Purchase: ${productName}${donationAmount > 0 ? ` + ₹${donationAmount} donation` : ''}`
});

// Change to:
await supabase.from('transactions').insert({
  user_id: user.id,
  type: 'purchase',
  amount: -finalTotal,  // ✓ negative (money deducted)
  status: 'completed',
  description: `Purchase: ${productName}${discount > 0 ? ` (₹${discount} discount)` : ''}${donationAmount > 0 ? ` + ₹${donationAmount} donation` : ''}`
});
```

### Fix 2: OrderModal.tsx Discount Check

```typescript
// Before refund (around line 95):
if (status === 'cancelled' || status === 'refunded') {
  if (currentOrder) {
    const hasDiscount = (currentOrder.discount_applied || 0) > 0;
    
    if (!hasDiscount) {
      // Process refund
      const { data: userProfile } = await supabase...
      // Update balance and create transaction
    }
    
    // Update notification message based on hasDiscount
  }
}
```

### Fix 3: Transaction Display Logic

```typescript
// Instead of checking amount sign, check transaction type
const getAmountDisplay = (txn: Transaction) => {
  const isDebit = ['purchase', 'withdraw', 'transfer_out'].includes(txn.type);
  const displayAmount = Math.abs(txn.amount);
  return {
    color: isDebit ? 'text-destructive' : 'text-success',
    prefix: isDebit ? '-' : '+',
    amount: displayAmount
  };
};
```

### Fix 4: Race Condition Prevention

```typescript
// Before cancelling, re-fetch order status
const handleCancelOrder = async (orderId: string) => {
  // Fetch fresh order data
  const { data: freshOrder } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  
  if (!freshOrder || freshOrder.status !== 'pending') {
    toast.error('Order status has changed. Please refresh.');
    loadOrders();
    return;
  }
  
  // Proceed with cancellation
  ...
};
```
