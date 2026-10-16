'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DayBookRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/payments?tab=daybook');
  }, [router]);

  return (
    <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <span className="text-xs">Redirecting to Transactions & Day Book reconciliation...</span>
    </div>
  );
}
