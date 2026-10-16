import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { UpiAccount } from './types';
import { UpiAccountCard } from './UpiAccountCard';

interface CompanySettingsViewProps {
  settings: any;
  loading: boolean;
  onRefresh: () => void;
  user: any;
  onUpdateUser: (updatedUser: any) => Promise<void> | void;
  onOpenAddUpi: () => void;
  onSetPrimaryUpi: (upiAccId: string) => Promise<void> | void;
  onDeleteUpi: (upiAccId: string, vpa: string) => void;
}

export function CompanySettingsView({
  settings,
  loading,
  onRefresh,
  user,
  onUpdateUser,
  onOpenAddUpi,
  onSetPrimaryUpi,
  onDeleteUpi,
}: CompanySettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'upi' | 'password'>('profile');

  // Owner Profile State
  const [ownerName, setOwnerName] = useState(user?.name || '');
  const [ownerPhone, setOwnerPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setOwnerName(user?.name || '');
    setOwnerPhone(user?.phone || '');
  }, [user?.name, user?.phone]);

  const handleSaveProfile = async () => {
    const cleanPhone = ownerPhone.replace(/\D/g, '').slice(0, 10);
    if (!ownerName.trim()) {
      Alert.alert('Required', 'Owner full name cannot be blank.');
      return;
    }
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Mobile', 'Mobile number must be strictly 10 digits.');
      return;
    }

    setSavingProfile(true);
    try {
      await mobileApiRequest(`/users/${user?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: ownerName.trim(),
          phone: cleanPhone,
          role: 'OWNER',
        }),
      });

      if (user) {
        await onUpdateUser({
          ...user,
          name: ownerName.trim(),
          phone: cleanPhone,
        });
      }

      Alert.alert('Profile Updated', `Owner profile saved. Your login mobile number is now ${cleanPhone}.`);
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update owner profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Short Password', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await mobileApiRequest('/users/profile/password', {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      });

      Alert.alert('Success', 'Password updated successfully! Please use your new password next time you log in.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const upiAccounts: UpiAccount[] = settings?.upiAccounts || [];
  const defaultUpiId =
    settings?.upiId ||
    upiAccounts.find((a) => a.isPrimary)?.upiId ||
    'Not Configured';

  return (
    <View style={styles.container}>
      {/* Tab Switcher Segmented Bar */}
      <View style={styles.tabToggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, activeTab === 'profile' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons
            name="person-outline"
            size={14}
            color={activeTab === 'profile' ? '#FFFFFF' : Colors.dark.textSecondary}
          />
          <Text style={[styles.toggleText, activeTab === 'profile' && styles.toggleTextActive]}>
            Owner Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, activeTab === 'upi' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('upi')}
        >
          <Ionicons
            name="qr-code-outline"
            size={14}
            color={activeTab === 'upi' ? '#FFFFFF' : Colors.dark.textSecondary}
          />
          <Text style={[styles.toggleText, activeTab === 'upi' && styles.toggleTextActive]}>
            UPI IDs ({upiAccounts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, activeTab === 'password' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('password')}
        >
          <Ionicons
            name="key-outline"
            size={14}
            color={activeTab === 'password' ? '#FFFFFF' : Colors.dark.textSecondary}
          />
          <Text style={[styles.toggleText, activeTab === 'password' && styles.toggleTextActive]}>
            Security
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* TAB 1: OWNER PROFILE & MOBILE                                             */}
      {/* ========================================================================= */}
      {activeTab === 'profile' ? (
        <View style={styles.tabContent}>
          <View style={styles.banner}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.dark.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Business Owner Account</Text>
              <Text style={styles.bannerSub}>
                Updating your mobile number updates your primary login ID for Shree Om Tiles administration.
              </Text>
            </View>
          </View>

          <Card elevated style={styles.formCard}>
            <Input
              label="Owner Full Name *"
              placeholder="e.g. Ramesh Kumar"
              value={ownerName}
              onChangeText={setOwnerName}
            />

            <Input
              label="Owner Mobile Number (Login ID) *"
              placeholder="e.g. 9876543210"
              value={ownerPhone}
              onChangeText={(t) => setOwnerPhone(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              maxLength={10}
            />

            <Button
              title={savingProfile ? 'Saving Changes...' : 'Save Owner Profile'}
              icon="checkmark-circle-outline"
              variant="primary"
              size="lg"
              loading={savingProfile}
              disabled={savingProfile || ownerPhone.length !== 10 || !ownerName.trim()}
              onPress={handleSaveProfile}
              style={{ marginTop: 6 }}
            />
          </Card>

          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>Merchant Overview</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Company Name</Text>
              <Text style={styles.infoVal}>{settings?.companyName || settings?.merchantName || 'Shree Om Tiles'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Primary Counter UPI</Text>
              <Text style={styles.infoValHighlight}>{defaultUpiId}</Text>
            </View>
          </Card>
        </View>
      ) : null}

      {/* ========================================================================= */}
      {/* TAB 2: STORE UPI IDS                                                      */}
      {/* ========================================================================= */}
      {activeTab === 'upi' ? (
        <View style={styles.tabContent}>
          <View style={styles.banner}>
            <Ionicons name="qr-code-outline" size={18} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: '#10B981' }]}>On-the-Spot UPI Checkout</Text>
              <Text style={styles.bannerSub}>
                Add all accounts you wish to receive money into. During counter billing, you can select which UPI ID to receive payment on the spot.
              </Text>
            </View>
          </View>

          <View style={styles.actionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Configured Accounts ({upiAccounts.length})
            </Text>
            <Button
              title="+ Add UPI ID"
              size="sm"
              variant="primary"
              onPress={onOpenAddUpi}
            />
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.loadingText}>Fetching UPI accounts...</Text>
            </View>
          ) : upiAccounts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="qr-code-outline" size={40} color={Colors.dark.textTertiary} />
              <Text style={styles.emptyTitle}>No UPI Accounts Configured</Text>
              <Text style={styles.emptySub}>
                Link your bank UPI ID so dynamic QR codes can be displayed on counter billing screens.
              </Text>
              <Button
                title="+ Link First UPI Account"
                size="sm"
                variant="primary"
                onPress={onOpenAddUpi}
                style={{ marginTop: 14 }}
              />
            </View>
          ) : (
            upiAccounts.map((account) => (
              <UpiAccountCard
                key={account.id}
                account={account}
                onSetPrimary={onSetPrimaryUpi}
                onDelete={onDeleteUpi}
              />
            ))
          )}
        </View>
      ) : null}

      {/* ========================================================================= */}
      {/* TAB 3: CHANGE PASSWORD                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'password' ? (
        <View style={styles.tabContent}>
          <View style={styles.banner}>
            <Ionicons name="key-outline" size={18} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: '#F59E0B' }]}>Change Security Password</Text>
              <Text style={styles.bannerSub}>
                Enter your desired new password and confirm it below. Once set, you can immediately log in with this new password.
              </Text>
            </View>
          </View>

          <Card elevated style={styles.formCard}>
            <Input
              label="New Password *"
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChangeText={setNewPassword}
              isPassword
            />

            <Input
              label="Confirm New Password *"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              isPassword
            />

            {confirmPassword && newPassword !== confirmPassword ? (
              <View style={styles.matchWarningRow}>
                <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                <Text style={styles.matchWarningText}>Passwords do not match</Text>
              </View>
            ) : null}

            {confirmPassword && newPassword === confirmPassword ? (
              <View style={styles.matchSuccessRow}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#10B981" />
                <Text style={styles.matchSuccessText}>Passwords match</Text>
              </View>
            ) : null}

            <Button
              title={savingPassword ? 'Updating...' : 'Set New Password'}
              icon="lock-closed-outline"
              variant="primary"
              size="lg"
              loading={savingPassword}
              disabled={
                savingPassword ||
                !newPassword ||
                newPassword.length < 6 ||
                newPassword !== confirmPassword
              }
              onPress={handleChangePassword}
              style={{ marginTop: 10 }}
            />
          </Card>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 3,
    marginBottom: 14,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  toggleTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  tabContent: {
    gap: 10,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    marginBottom: 6,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.dark.primary,
  },
  bannerSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  formCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  infoCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: 6,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  infoVal: {
    fontSize: 12,
    color: Colors.dark.text,
    fontWeight: '600',
  },
  infoValHighlight: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  centerBox: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  emptyCard: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  matchWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  matchWarningText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  matchSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  matchSuccessText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
});
