import React, { useState } from 'react';
import { type DepositModalProps } from './deposit/constants';
import { CountrySelection, ForeignCountryPicker } from './deposit/CountryScreens';
import { BinancePayScreen, NoBinanceScreen, BinanceQuestion } from './deposit/ForeignScreens';
import IndiaPaymentScreen from './deposit/IndiaPaymentScreen';

const DepositModal: React.FC<DepositModalProps> = (props) => {
  const {
    open, onOpenChange, depositAmount, onDepositAmountChange,
    paymentSettings, loading, onAutoDeposit, onManualDeposit,
    submittingManual, transactionId, onTransactionIdChange,
    senderName, onSenderNameChange, initialTab
  } = props;

  const [selectedCountry, setSelectedCountry] = useState<'india' | 'foreign' | null>(null);
  const [foreignCountry, setForeignCountry] = useState('');
  const [foreignFlag, setForeignFlag] = useState('');
  const [hasBinance, setHasBinance] = useState<boolean | null>(null);
  const [depositTab, setDepositTab] = useState<'auto' | 'manual'>(initialTab === 'manual' ? 'manual' : 'auto');

  React.useEffect(() => {
    if (open && initialTab) {
      setDepositTab(initialTab === 'manual' ? 'manual' : 'auto');
    }
  }, [open, initialTab]);

  const handleBack = () => {
    if (hasBinance !== null) setHasBinance(null);
    else if (selectedCountry === 'foreign' && foreignCountry) { setForeignCountry(''); setForeignFlag(''); }
    else { setSelectedCountry(null); setForeignCountry(''); setHasBinance(null); }
  };

  const resetCountry = () => { setSelectedCountry(null); setForeignCountry(''); setForeignFlag(''); setHasBinance(null); };

  // Step 1: Country selection
  if (!selectedCountry) {
    return <CountrySelection open={open} onOpenChange={onOpenChange} onSelectIndia={() => setSelectedCountry('india')} onSelectForeign={() => setSelectedCountry('foreign')} />;
  }

  // Step 2: Foreign country picker
  if (selectedCountry === 'foreign' && !foreignCountry) {
    return <ForeignCountryPicker open={open} onOpenChange={onOpenChange} onSelectCountry={(name, flag) => { setForeignCountry(name); setForeignFlag(flag); }} onBack={handleBack} />;
  }

  // Step 3: Binance question
  if (selectedCountry === 'foreign' && foreignCountry && hasBinance === null) {
    return <BinanceQuestion open={open} onOpenChange={onOpenChange} foreignCountry={foreignCountry} foreignFlag={foreignFlag} onHasBinance={() => setHasBinance(true)} onNoBinance={() => setHasBinance(false)} onBack={handleBack} />;
  }

  // Step 4a: Has Binance
  if (selectedCountry === 'foreign' && hasBinance === true) {
    return <BinancePayScreen open={open} onOpenChange={onOpenChange} depositAmount={depositAmount} onDepositAmountChange={onDepositAmountChange} senderName={senderName} onSenderNameChange={onSenderNameChange} transactionId={transactionId} onTransactionIdChange={onTransactionIdChange} onManualDeposit={onManualDeposit} submittingManual={submittingManual} onBack={handleBack} />;
  }

  // Step 4b: No Binance
  if (selectedCountry === 'foreign' && hasBinance === false) {
    return <NoBinanceScreen open={open} onOpenChange={onOpenChange} foreignCountry={foreignCountry} foreignFlag={foreignFlag} onBack={handleBack} />;
  }

  // India payment flow
  return <IndiaPaymentScreen open={open} onOpenChange={onOpenChange} depositAmount={depositAmount} onDepositAmountChange={onDepositAmountChange} paymentSettings={paymentSettings} loading={loading} onAutoDeposit={onAutoDeposit} onManualDeposit={onManualDeposit} submittingManual={submittingManual} transactionId={transactionId} onTransactionIdChange={onTransactionIdChange} senderName={senderName} onSenderNameChange={onSenderNameChange} depositTab={depositTab} onTabChange={setDepositTab} onChangeCountry={resetCountry} />;
};

export default DepositModal;
