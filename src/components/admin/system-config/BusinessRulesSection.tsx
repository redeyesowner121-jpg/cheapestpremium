import React from 'react';
import SettingsGroup, { SettingField } from './SettingsGroup';

const feeFields: SettingField[] = [
  { key: 'escrow_fee_percent', label: 'Escrow Fee (%)', type: 'number', hint: 'Deducted from seller on escrow release' },
  { key: 'seller_commission_percent', label: 'Seller Commission (%)', type: 'number', hint: 'Platform commission on seller orders' },
  { key: 'foreign_currency_fee_percent', label: 'Foreign Currency Fee (%)', type: 'number' },
  { key: 'aax_conversion_fee_percent', label: 'AAX Conversion Fee (%)', type: 'number' },
  { key: 'bulk_discount_percent', label: 'Bulk Discount (%)', type: 'number' },
  { key: 'bulk_discount_min_qty', label: 'Bulk Discount Min Qty', type: 'number' },
];

const limitFields: SettingField[] = [
  { key: 'min_withdrawal_amount', label: 'Min Withdrawal (₹)', type: 'number' },
  { key: 'min_deposit_amount', label: 'Min Deposit (₹)', type: 'number' },
  { key: 'escrow_expiry_minutes', label: 'Escrow Expiry (minutes)', type: 'number' },
  { key: 'binance_reservation_minutes', label: 'Binance Reservation (minutes)', type: 'number' },
  { key: 'razorpay_reservation_minutes', label: 'Razorpay Reservation (minutes)', type: 'number' },
];

const BusinessRulesSection: React.FC = () => (
  <div className="space-y-6">
    <SettingsGroup
      title="Fees & Commission"
      description="Platform fees, commissions, and discount rules"
      fields={feeFields}
    />
    <SettingsGroup
      title="Limits & Timeouts"
      description="Minimums and time-based business rules"
      fields={limitFields}
    />
  </div>
);

export default BusinessRulesSection;
