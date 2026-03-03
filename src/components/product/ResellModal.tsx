import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, Link as LinkIcon, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';

interface ResellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  selectedVariation: any;
  resellerPrice: number;
  userId: string;
}

const ResellModal: React.FC<ResellModalProps> = ({
  open, onOpenChange, product, selectedVariation, resellerPrice, userId
}) => {
  const [customPrice, setCustomPrice] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { formatPrice } = useCurrencyFormat();

  const profit = customPrice ? parseFloat(customPrice) - resellerPrice : 0;

  const handleGenerate = async () => {
    const price = parseFloat(customPrice);
    if (isNaN(price) || price <= resellerPrice) {
      toast.error(`Price must be higher than reseller price ${formatPrice(resellerPrice)}`);
      return;
    }

    setLoading(true);
    try {
      const linkCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { error } = await supabase.from('resale_links').insert({
        reseller_id: userId,
        product_id: product.id,
        variation_id: selectedVariation?.id || null,
        custom_price: price,
        reseller_price: resellerPrice,
        link_code: linkCode,
      });

      if (error) throw error;

      const url = `https://t.me/Cheap_reseller_bot?start=buy_${linkCode}`;
      setGeneratedLink(url);
      toast.success('Resale link created!');
    } catch (err: any) {
      console.error('Resale link error:', err);
      toast.error(err?.message || 'Failed to create resale link');
    }
    setLoading(false);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setCustomPrice('');
      setGeneratedLink('');
      setCopied(false);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-primary" />
            Create Resale Link
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-sm font-semibold text-foreground">{product?.name}</p>
            {selectedVariation && (
              <p className="text-xs text-muted-foreground">{selectedVariation.name}</p>
            )}
            <p className="text-sm text-primary font-bold mt-1">
              Reseller Price: {formatPrice(resellerPrice)}
            </p>
          </div>

          {!generatedLink ? (
            <>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Your Selling Price (₹)
                </label>
                <Input
                  type="number"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder={`Min: ₹${resellerPrice + 1}`}
                  className="rounded-xl"
                  min={resellerPrice + 1}
                />
              </div>

              {profit > 0 && (
                <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-xl p-3">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Profit per sale: {formatPrice(profit)}</span>
                </div>
              )}

              <Button onClick={handleGenerate} disabled={loading || !customPrice} className="w-full rounded-xl">
                {loading ? 'Generating...' : 'Generate Resale Link'}
              </Button>
            </>
          ) : (
            <>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Your Resale Link:</p>
                <p className="text-sm font-mono break-all text-foreground">{generatedLink}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-muted/50 rounded-xl p-2">
                  <p className="text-xs text-muted-foreground">Selling Price</p>
                  <p className="font-bold text-foreground">{formatPrice(parseFloat(customPrice))}</p>
                </div>
                <div className="bg-primary/10 rounded-xl p-2">
                  <p className="text-xs text-muted-foreground">Your Profit</p>
                  <p className="font-bold text-primary">{formatPrice(profit)}</p>
                </div>
              </div>

              <Button onClick={copyLink} className="w-full rounded-xl" variant={copied ? "secondary" : "default"}>
                {copied ? <><Check className="w-4 h-4 mr-2" /> Copied!</> : <><Copy className="w-4 h-4 mr-2" /> Copy Link</>}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResellModal;
