'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Mobile number must be strictly 10 digits');
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest<{
        access_token: string;
        user: {
          id: string;
          phone: string;
          role: string;
          scope: string | null;
          name?: string;
        };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
      });
      login(data.access_token, data.user);
    } catch (err: unknown) {
      setError((err as Error).message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center p-4 bg-background text-foreground overflow-hidden">
      {/* Subtle ambient lighting gradients */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[38rem] h-[38rem] rounded-full bg-primary/5 blur-[120px] dark:bg-primary/10" />

      {/* Top Floating Theme Switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <ThemeToggle variant="compact" />
      </div>

      <div className="relative w-full max-w-md space-y-6 rounded-3xl border border-border/80 bg-card/75 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-xl shadow-lg">
            SO
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Shree Om Tiles</h1>
          <p className="text-xs text-muted-foreground">
            Sign in to access your dashboard
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
              Mobile Number (10 digits)
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              required
              className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono transition-colors"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1.5">Password</label>
            <input
              type="password"
              required
              className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/25 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl shadow-md transition-all active:scale-[0.98]"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
