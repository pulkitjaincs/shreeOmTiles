'use client';

import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  MessageCircle, 
  Download, 
  Loader2 
} from 'lucide-react';
import { Invoice } from './types';
import { formatINR } from '@/lib/formatters';

interface ShareInvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onShareWhatsApp: (invoice: Invoice) => void;
  onDownloadPdf: (id: string, no: string) => void;
  sharingId: string | null;
  downloadingId: string | null;
}

export function ShareInvoiceModal({
  invoice,
  onClose,
  onShareWhatsApp,
  onDownloadPdf,
  sharingId,
  downloadingId,
}: ShareInvoiceModalProps) {
  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-[1.5rem] border border-border bg-card p-[clamp(1.25rem,2.5vw,1.75rem)] shadow-2xl space-y-6 text-center text-foreground">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
          <CheckCircle2 className="h-7 w-7" />
        </div>

        <div className="space-y-1">
          <h3 className="text-[1.125rem] font-bold text-foreground">Invoice Generated Successfully!</h3>
          <p className="text-[0.875rem] text-primary font-mono font-semibold">
            #{invoice.invoiceNo}
          </p>
          <p className="text-[0.75rem] text-muted-foreground pt-1">
            {invoice.party?.name || 'Customer'} • {formatINR(invoice.total)}
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={() => onShareWhatsApp(invoice)}
            disabled={sharingId === invoice.id}
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3 rounded-[0.75rem] shadow-md disabled:opacity-60 transition text-[0.8125rem] active:scale-98"
          >
            {sharingId === invoice.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            <span>
              {sharingId === invoice.id ? 'Generating PDF...' : 'Share on WhatsApp'}
            </span>
          </button>

          <Button
            onClick={() => onDownloadPdf(invoice.id, invoice.invoiceNo)}
            disabled={downloadingId === invoice.id}
            className="w-full bg-card hover:bg-muted text-foreground font-medium py-2 rounded-[0.75rem] border border-border flex items-center justify-center gap-2 shadow-2xs active:scale-98 text-[0.8125rem]"
          >
            {downloadingId === invoice.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Download className="h-4 w-4 text-primary" />
            )}
            Download PDF
          </Button>

          <button
            onClick={onClose}
            className="text-[0.75rem] text-muted-foreground hover:text-foreground pt-2 block mx-auto transition"
          >
            Done / Next Customer
          </button>
        </div>
      </div>
    </div>
  );
}
