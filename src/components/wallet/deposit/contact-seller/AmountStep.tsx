import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ContactState } from './types';

interface Props {
  state: ContactState;
  setState: (patch: Partial<ContactState>) => void;
  onContinue: () => void;
}

export const AmountStep: React.FC<Props> = ({ state, setState, onContinue }) => (
  <div className="mt-2 space-y-4">
    <div className="p-3 bg-muted rounded-xl text-sm">
      <p className="text-muted-foreground">Country: <span className="text-foreground font-medium">{state.selectedFlag} {state.selectedCountry}</span></p>
      <p className="text-muted-foreground">Product: <span className="text-foreground font-medium">{state.selectedProductName}</span></p>
    </div>

    <div>
      <label className="text-sm font-medium text-foreground mb-1 block">Deposit Amount (in your currency)</label>
      <Input
        type="number"
        placeholder="Enter amount"
        value={state.depositAmount}
        onChange={(e) => setState({ depositAmount: e.target.value })}
        className="h-14 text-2xl text-center font-bold rounded-xl"
      />
    </div>

    <div>
      <label className="text-sm font-medium text-foreground mb-1 block">Currency</label>
      <Input
        type="text"
        placeholder="USD, BDT, PKR, etc."
        value={state.currency}
        onChange={(e) => setState({ currency: e.target.value.toUpperCase() })}
        className="h-10 rounded-xl"
      />
    </div>

    <div>
      <label className="text-sm font-medium text-foreground mb-1 block">Extra Note (optional)</label>
      <Input
        type="text"
        placeholder="Any additional info..."
        value={state.extraNote}
        onChange={(e) => setState({ extraNote: e.target.value })}
        className="h-10 rounded-xl"
      />
    </div>

    <Button
      onClick={onContinue}
      className="w-full h-12 btn-gradient rounded-xl"
      disabled={!state.depositAmount || parseFloat(state.depositAmount) <= 0}
    >
      Continue
    </Button>
  </div>
);
