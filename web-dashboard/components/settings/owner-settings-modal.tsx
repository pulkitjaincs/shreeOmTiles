'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Star,
  Loader2,
  ShieldCheck,
  User,
  Phone,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

export interface UpiAccount {
  id: string;
  upiId: string;
  merchantName: string;
  isPrimary: boolean;
  createdAt: string;
}

interface OwnerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}

export function OwnerSettingsModal({
  isOpen,
  onClose,
  userRole,
}: OwnerSettingsModalProps) {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'upi' | 'password'>('profile');

  // Owner Profile & Mobile State
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Multi-UPI State
  const [upiAccounts, setUpiAccounts] = useState<UpiAccount[]>([]);
  const [newUpiId, setNewUpiId] = useState('');
  const [newMerchantName, setNewMerchantName] = useState('Shree Om Tiles');
  const [newIsPrimary, setNewIsPrimary] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [upiMessage, setUpiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const data = await apiRequest<{
        upiId: string | null;
        merchantName: string;
        upiAccounts: UpiAccount[];
      }>('/settings');
      setUpiAccounts(data.upiAccounts || []);
    } catch {
      // Quiet fail if network glitch
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    // Reset messages and fields
    setProfileMessage(null);
    setUpiMessage(null);
    setPasswordMessage(null);
    setNewPassword('');
    setConfirmPassword('');
    setNewUpiId('');
    setNewMerchantName('Shree Om Tiles');
    setNewIsPrimary(false);

    if (user) {
      setOwnerName(user.name || '');
      setOwnerPhone(user.phone || '');
    }

    // Default tab
    setActiveTab(userRole === 'OWNER' ? 'profile' : 'password');

    // Fetch existing settings
    void fetchSettings();
  }, [isOpen, user, userRole]);

  const handleSaveOwnerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    const cleanPhone = ownerPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setProfileMessage({
        type: 'error',
        text: 'Mobile number must be strictly 10 digits.',
      });
      return;
    }

    if (!ownerName.trim()) {
      setProfileMessage({
        type: 'error',
        text: 'Director full name cannot be blank.',
      });
      return;
    }

    setSavingProfile(true);
    try {
      await apiRequest(`/users/${user?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: ownerName.trim(),
          phone: cleanPhone,
          role: 'OWNER',
        }),
      });

      updateUser({
        name: ownerName.trim(),
        phone: cleanPhone,
      });

      setProfileMessage({
        type: 'success',
        text: `✓ Successfully updated director profile! Mobile number is now ${cleanPhone}.`,
      });
    } catch (err: unknown) {
      setProfileMessage({
        type: 'error',
        text: (err as Error).message || 'Failed to update director profile',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddUpiAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingAccount(true);
    setUpiMessage(null);

    const cleanUpi = newUpiId.trim();
    if (!cleanUpi.includes('@')) {
      setUpiMessage({
        type: 'error',
        text: 'Please enter a valid UPI ID (e.g. storename@icici or 9876543210@paytm)',
      });
      setAddingAccount(false);
      return;
    }

    try {
      const res = await apiRequest<{
        message: string;
        upiAccounts: UpiAccount[];
      }>('/settings/upi-accounts', {
        method: 'POST',
        body: JSON.stringify({
          upiId: cleanUpi,
          merchantName: newMerchantName.trim() || 'Shree Om Tiles',
          isPrimary: newIsPrimary || upiAccounts.length === 0,
        }),
      });
      setUpiAccounts(res.upiAccounts);
      setNewUpiId('');
      setNewMerchantName('Shree Om Tiles');
      setNewIsPrimary(false);
      setUpiMessage({
        type: 'success',
        text: res.message || `✓ Added UPI ID: ${cleanUpi}`,
      });
    } catch (err: unknown) {
      setUpiMessage({
        type: 'error',
        text: (err as Error).message || 'Failed to add UPI account',
      });
    } finally {
      setAddingAccount(false);
    }
  };

  const handleDeleteUpiAccount = async (id: string, upiId: string) => {
    if (!confirm(`Are you sure you want to remove ${upiId}?`)) return;

    setActionLoadingId(id);
    setUpiMessage(null);
    try {
      const res = await apiRequest<{
        message: string;
        upiAccounts: UpiAccount[];
      }>(`/settings/upi-accounts/${id}`, {
        method: 'DELETE',
      });
      setUpiAccounts(res.upiAccounts);
      setUpiMessage({
        type: 'success',
        text: res.message || `✓ Removed ${upiId}`,
      });
    } catch (err: unknown) {
      setUpiMessage({
        type: 'error',
        text: (err as Error).message || 'Failed to delete UPI account',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSetPrimary = async (id: string, upiId: string) => {
    setActionLoadingId(id);
    setUpiMessage(null);
    try {
      const res = await apiRequest<{
        message: string;
        upiAccounts: UpiAccount[];
      }>(`/settings/upi-accounts/${id}/primary`, {
        method: 'PATCH',
      });
      setUpiAccounts(res.upiAccounts);
      setUpiMessage({
        type: 'success',
        text: res.message || `✓ ${upiId} set as default primary UPI`,
      });
    } catch (err: unknown) {
      setUpiMessage({
        type: 'error',
        text: (err as Error).message || 'Failed to set primary UPI',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New password and confirmation do not match' });
      return;
    }

    setSavingPassword(true);
    try {
      await apiRequest('/users/profile/password', {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      });
      setPasswordMessage({ type: 'success', text: '✓ Password updated successfully! Please use your new password next time you log in.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordMessage({ type: 'error', text: (err as Error).message || 'Failed to update password' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!isOpen) return null;

  const isOwner = userRole === 'OWNER';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Card */}
      <div className="relative w-full max-w-xl max-h-[88dvh] rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl z-10 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between bg-card/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Director Store Settings</h3>
              <p className="text-xs text-muted-foreground">Manage payment UPI IDs and personal security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border/60 bg-muted/40 px-5 pt-2 overflow-x-auto">
          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-semibold border-b-2 transition shrink-0 ${
                activeTab === 'profile'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              Director Profile & Mobile
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('upi')}
              className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-semibold border-b-2 transition shrink-0 ${
                activeTab === 'upi'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <QrCode className="h-3.5 w-3.5" />
              Store UPI IDs ({upiAccounts.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-semibold border-b-2 transition shrink-0 ${
              activeTab === 'password'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Change Password
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto max-h-[70dvh] space-y-4">
          {/* TAB 0: OWNER PROFILE & MOBILE NUMBER */}
          {activeTab === 'profile' && isOwner && (
            <form onSubmit={handleSaveOwnerProfile} className="space-y-4">
              {profileMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    profileMessage.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                      : 'bg-destructive/10 border-destructive/30 text-destructive'
                  }`}
                >
                  {profileMessage.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/10 text-xs text-primary flex items-start gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <div>
                  <span className="font-semibold block text-primary">Business Director Mobile Number</span>
                  <span className="text-muted-foreground">
                    Updating your mobile number updates your primary login ID for Shree Om Tiles administration.
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/80 bg-muted/30 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Director Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2.5 text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Director Mobile Number (Login ID) (10 digits) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      required
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="e.g. 9876543210"
                      className="w-full rounded-xl border border-border/80 bg-card pl-9 pr-3.5 py-2.5 text-xs text-foreground font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Must be exactly 10 digits. You will use this mobile number to log in.
                  </p>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile || ownerPhone.length !== 10}
                    className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl transition inline-flex items-center gap-1.5 shadow-md shadow-primary/20"
                  >
                    {savingProfile ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Save Director Profile & Mobile</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
          {/* TAB 1: UPI ID MANAGEMENT */}
          {activeTab === 'upi' && isOwner && (
            <div className="space-y-4">
              {/* Feedback Message */}
              {upiMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    upiMessage.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                      : 'bg-destructive/10 border-destructive/30 text-destructive'
                  }`}
                >
                  {upiMessage.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <span>{upiMessage.text}</span>
                </div>
              )}

              {/* Explanatory banner */}
              <div className="p-3 rounded-xl border border-primary/20 bg-primary/10 text-xs text-primary flex items-start gap-2.5">
                <QrCode className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <div>
                  <span className="font-semibold block text-primary">On-the-Spot UPI Selection</span>
                  <span className="text-muted-foreground">
                    Add all accounts you wish to receive money into. During checkout or settlement, the cashier can select which UPI ID to receive payment on the spot.
                  </span>
                </div>
              </div>

              {/* List of existing accounts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Configured UPI Accounts ({upiAccounts.length})
                  </span>
                  {loadingSettings && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  )}
                </div>

                {upiAccounts.length === 0 && !loadingSettings ? (
                  <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center text-xs text-muted-foreground">
                    No UPI IDs registered yet. Add your first UPI ID below so counter QR codes can be generated.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upiAccounts.map((acc) => {
                      const isActionBusy = actionLoadingId === acc.id;
                      return (
                        <div
                          key={acc.id}
                          className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                            acc.isPrimary
                              ? 'border-emerald-500/40 bg-emerald-500/10 shadow-sm'
                              : 'border-border/80 bg-muted/30'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-bold text-foreground tracking-wide">
                                {acc.upiId}
                              </span>
                              {acc.isPrimary ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                                  <Star className="h-3 w-3 fill-emerald-500 text-emerald-500" />
                                  Default Primary
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimary(acc.id, acc.upiId)}
                                  disabled={isActionBusy}
                                  className="text-[11px] font-medium text-muted-foreground hover:text-primary transition underline underline-offset-2"
                                >
                                  {isActionBusy ? 'Updating...' : 'Set as Default'}
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              Label: <span className="text-foreground">{acc.merchantName}</span>
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteUpiAccount(acc.id, acc.upiId)}
                            disabled={isActionBusy}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg border border-transparent hover:border-destructive/20 transition shrink-0"
                            title={`Remove ${acc.upiId}`}
                          >
                            {isActionBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add New UPI Account Card */}
              <form
                onSubmit={handleAddUpiAccount}
                className="p-4 rounded-xl border border-border/80 bg-muted/30 space-y-3 pt-3.5"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span>Register New UPI ID</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      UPI ID (VPA) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. shreeom@icici or 9876543210@paytm"
                      value={newUpiId}
                      onChange={(e) => setNewUpiId(e.target.value)}
                      className="w-full rounded-xl border border-border/80 bg-card px-3 py-2 text-xs text-foreground font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Account / Merchant Label
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Counter 1 or ICICI Current"
                      value={newMerchantName}
                      onChange={(e) => setNewMerchantName(e.target.value)}
                      className="w-full rounded-xl border border-border/80 bg-card px-3 py-2 text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground select-none">
                    <input
                      type="checkbox"
                      checked={newIsPrimary}
                      onChange={(e) => setNewIsPrimary(e.target.checked)}
                      className="rounded border-border/80 bg-card text-primary focus:ring-0"
                    />
                    <span>Make this the default UPI ID</span>
                  </label>

                  <button
                    type="submit"
                    disabled={addingAccount || !newUpiId.trim()}
                    className="px-3.5 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl transition inline-flex items-center gap-1.5 shadow-md shadow-primary/20"
                  >
                    {addingAccount ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add UPI ID</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: OWNER PASSWORD CHANGE */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Info notice */}
              <div className="p-3 rounded-xl border border-primary/20 bg-primary/10 text-xs text-primary flex items-start gap-2">
                <KeyRound className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span className="text-muted-foreground">
                  Enter your desired new password and confirm it below. Once set, you can immediately log in with this new password.
                </span>
              </div>

              {/* Password feedback message */}
              {passwordMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    passwordMessage.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                      : 'bg-destructive/10 border-destructive/30 text-destructive'
                  }`}
                >
                  {passwordMessage.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Enter at least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-muted/50 px-3.5 py-2.5 text-sm text-foreground pr-10 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-muted/50 px-3.5 py-2.5 text-sm text-foreground pr-10 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Passwords do not match
                  </p>
                )}

                {confirmPassword && newPassword === confirmPassword && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Passwords match
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border/80 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
                  className="px-4 py-2.5 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl transition inline-flex items-center gap-1.5 shadow-md shadow-primary/20"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Set New Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
