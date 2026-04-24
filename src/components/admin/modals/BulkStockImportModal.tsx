import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseBulkImport, parseCredential } from '@/lib/credentialParser';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  variationId?: string;
  onSuccess: () => void;
}

const EXAMPLE = `Email: account1@gmail.com
Password: Pass@123
2FA: JBSWY3DPEHPK3PXP
---
Email: account2@gmail.com
Password: Pass@456
2FA: NB2W45DFOIYAJBSW
---
Email: account3@gmail.com
Password: Pass@789
2FA: ONSWG4TFOQ======`;

const BulkStockImportModal: React.FC<Props> = ({ open, onOpenChange, productId, variationId, onSuccess }) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const blocks = useMemo(() => parseBulkImport(text), [text]);
  const preview = useMemo(() => blocks.slice(0, 3).map(parseCredential), [blocks]);

  const handleImport = async () => {
    if (blocks.length === 0) {
      return toast.error('No accounts to import. Separate each with `---`');
    }
    setSubmitting(true);
    const rows = blocks.map((access_link) => ({
      product_id: productId,
      variation_id: variationId || null,
      access_link,
    }));
    const { error } = await (supabase as any).from('product_stock_items').insert(rows);
    setSubmitting(false);
    if (error) return toast.error('Import failed: ' + error.message);
    toast.success(`✅ ${blocks.length} accounts imported!`);
    setText('');
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" /> Bulk Stock Import
          </DialogTitle>
          <DialogDescription>
            Paste multiple accounts at once. Separate each account with <code className="px-1 py-0.5 bg-muted rounded text-xs">---</code> on its own line.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Accounts to import</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <FileText className="w-3 h-3 mr-1" /> {blocks.length} parsed
              </Badge>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setText(EXAMPLE)}>
                Load example
              </Button>
            </div>
          </div>

          <Textarea
            placeholder={EXAMPLE}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[300px] font-mono text-xs"
          />

          {preview.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                Preview (first {preview.length} of {blocks.length})
              </div>
              {preview.map((p, i) => (
                <div key={i} className="text-[11px] flex items-center gap-2 flex-wrap bg-background rounded p-2 border border-border/50">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="font-mono text-muted-foreground">#{i + 1}</span>
                  {p.email && <Badge variant="outline" className="text-[10px] h-5">📧 {p.email.slice(0, 24)}{p.email.length > 24 ? '…' : ''}</Badge>}
                  {p.password && <Badge variant="outline" className="text-[10px] h-5">🔑 ••••</Badge>}
                  {p.twoFASecret && <Badge variant="outline" className="text-[10px] h-5">🔐 2FA</Badge>}
                  {p.link && <Badge variant="outline" className="text-[10px] h-5">🔗 Link</Badge>}
                  {!p.hasStructured && !p.link && <Badge variant="outline" className="text-[10px] h-5">📝 Text</Badge>}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={submitting || blocks.length === 0} className="flex-1">
              {submitting ? 'Importing...' : `Import ${blocks.length} accounts`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkStockImportModal;
