import React, { useMemo } from 'react';
import { Globe, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { COUNTRIES } from './constants';

interface CountrySelectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectIndia: () => void;
  onSelectForeign: () => void;
}

export const CountrySelection: React.FC<CountrySelectionProps> = ({ open, onOpenChange, onSelectIndia, onSelectForeign }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm mx-auto rounded-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-primary" />Select Your Country</DialogTitle>
        <DialogDescription>Choose your region for the right payment method</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 mt-4">
        <button onClick={onSelectIndia} className="w-full p-4 bg-muted rounded-2xl flex items-center gap-4 hover:bg-muted/80 transition-colors active:scale-[0.98]">
          <span className="text-3xl">🇮🇳</span>
          <div className="text-left">
            <p className="font-semibold text-foreground">India</p>
            <p className="text-xs text-muted-foreground">UPI, QR Code, Card Payment</p>
          </div>
        </button>
        <button onClick={onSelectForeign} className="w-full p-4 bg-muted rounded-2xl flex items-center gap-4 hover:bg-muted/80 transition-colors active:scale-[0.98]">
          <span className="text-3xl">🌍</span>
          <div className="text-left">
            <p className="font-semibold text-foreground">Other Country</p>
            <p className="text-xs text-muted-foreground">Binance Pay</p>
          </div>
        </button>
      </div>
    </DialogContent>
  </Dialog>
);

interface ForeignCountryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCountry: (name: string, flag: string) => void;
  onBack: () => void;
}

export const ForeignCountryPicker: React.FC<ForeignCountryPickerProps> = ({ open, onOpenChange, onSelectCountry, onBack }) => {
  const [countrySearch, setCountrySearch] = React.useState('');
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()));
  }, [countrySearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-primary" />Select Your Country</DialogTitle>
        </DialogHeader>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input type="text" placeholder="Search country..." value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} className="pl-10 h-10 rounded-xl bg-muted border-0" />
        </div>
        <div className="space-y-1 mt-2 overflow-y-auto max-h-[50vh] pr-1">
          {filteredCountries.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">No country found</p>
          ) : (
            filteredCountries.map((country) => (
              <button key={country.name} onClick={() => { onSelectCountry(country.name, country.flag); setCountrySearch(''); }} className="w-full p-3 bg-muted rounded-xl text-left text-sm font-medium text-foreground hover:bg-primary/10 transition-colors">
                {country.flag} {country.name}
              </button>
            ))
          )}
        </div>
        <Button variant="ghost" onClick={onBack} className="w-full mt-2 rounded-xl">← Back</Button>
      </DialogContent>
    </Dialog>
  );
};
