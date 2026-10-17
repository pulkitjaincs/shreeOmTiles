/**
 * Utility formatters matching web-dashboard
 */

const INR_WHOLE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const INR_DECIMAL = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(val?: number | string | null): string {
  if (val === undefined || val === null || val === '') return '₹0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '₹0';

  const hasDecimals = num % 1 !== 0;
  return (hasDecimals ? INR_DECIMAL : INR_WHOLE).format(num);
}

export function formatDate(val?: string | Date | null): string {
  if (!val) return '—';
  try {
    const d = typeof val === 'string' ? new Date(val) : val;
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatDateTime(val?: string | Date | null): string {
  if (!val) return '—';
  try {
    const d = typeof val === 'string' ? new Date(val) : val;
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-10);
}

export function getInitials(name?: string | null): string {
  if (!name) return 'SO';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getWhatsAppUrl(phone?: string | null, text?: string): string {
  const msg = text ? encodeURIComponent(text) : '';
  if (!phone) {
    return msg ? `https://wa.me/?text=${msg}` : 'https://wa.me/';
  }

  const digits = phone.replace(/\D/g, '');
  if (!digits || digits.length < 10) {
    return msg ? `https://wa.me/?text=${msg}` : 'https://wa.me/';
  }

  // Exact 10-digit Indian phone number: add country code 91
  if (digits.length === 10) {
    return `https://wa.me/91${digits}${msg ? `?text=${msg}` : ''}`;
  }

  // 12-digit Indian phone with leading 91 (e.g. 919876543210)
  if (digits.length === 12 && digits.startsWith('91')) {
    return `https://wa.me/${digits}${msg ? `?text=${msg}` : ''}`;
  }

  // 11-digit Indian phone with leading 0 (e.g. 09876543210)
  if (digits.length === 11 && digits.startsWith('0')) {
    return `https://wa.me/91${digits.slice(1)}${msg ? `?text=${msg}` : ''}`;
  }

  // International phone number with country code already included
  return `https://wa.me/${digits}${msg ? `?text=${msg}` : ''}`;
}
