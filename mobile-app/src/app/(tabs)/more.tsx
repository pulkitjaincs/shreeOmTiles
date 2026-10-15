import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cleanPhoneNumber, getInitials } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Party } from '@/components/parties/types';
import { PartyFormModal } from '@/components/parties/PartyFormModal';
import { PartyStatementDrawer } from '@/components/parties/PartyStatementDrawer';

import { Warehouse } from '@/components/warehouses/types';
import { WarehouseFormModal } from '@/components/warehouses/WarehouseFormModal';

import { StaffUser } from '@/components/settings/types';
import { StaffFormModal } from '@/components/settings/StaffFormModal';
import { ResetPasswordModal } from '@/components/settings/ResetPasswordModal';
import { AddUpiModal } from '@/components/settings/AddUpiModal';

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isOwner = user?.role === 'OWNER';
  const isAdmin = user?.role === 'ADMIN';

  const [activeSection, setActiveSection] = useState<
    'MENU' | 'PARTIES' | 'STAFF' | 'SETTINGS' | 'WAREHOUSES'
  >('MENU');

  // Parties State
  const [parties, setParties] = useState<Party[]>([]);
  const [partiesLoading, setPartiesLoading] = useState(false);
  const [partySearch, setPartySearch] = useState('');
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [statementParty, setStatementParty] = useState<Party | null>(null);

  // Warehouses State
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [zeroOutLoading, setZeroOutLoading] = useState<string | null>(null);
  const [deleteWhLoading, setDeleteWhLoading] = useState<string | null>(null);

  // Staff State
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [resetModalUser, setResetModalUser] = useState<StaffUser | null>(null);

  // Settings State
  const [settings, setSettings] = useState<any>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [upiAccountModalOpen, setUpiAccountModalOpen] = useState(false);

  // Load Parties
  const loadParties = useCallback(async (force = false) => {
    setPartiesLoading(true);
    try {
      const data = await cachedMobileApiRequest<Party[]>('/parties', {
        forceRefresh: force,
        onRevalidate: (fresh) => setParties(fresh || []),
      });
      setParties(data || []);
    } catch (err: any) {
      console.warn('Parties load failed', err.message);
    } finally {
      setPartiesLoading(false);
    }
  }, []);

  // Load Warehouses
  const loadWarehouses = useCallback(async (force = false) => {
    setWarehousesLoading(true);
    try {
      const data = await cachedMobileApiRequest<Warehouse[]>('/warehouses', {
        forceRefresh: force,
        onRevalidate: (fresh) => setWarehouses(fresh || []),
      });
      setWarehouses(data || []);
    } catch (err: any) {
      console.warn('Warehouses load failed', err.message);
    } finally {
      setWarehousesLoading(false);
    }
  }, []);

  // Load Staff
  const loadStaff = useCallback(async (force = false) => {
    if (!isOwner && !isAdmin) return;
    setStaffLoading(true);
    try {
      const data = await cachedMobileApiRequest<StaffUser[]>('/users', {
        forceRefresh: force,
        onRevalidate: (fresh) => setStaffList(fresh || []),
      });
      setStaffList(data || []);
    } catch (err: any) {
      console.warn('Staff load failed', err.message);
    } finally {
      setStaffLoading(false);
    }
  }, [isOwner, isAdmin]);

  // Load Settings
  const loadSettings = useCallback(async (force = false) => {
    setSettingsLoading(true);
    try {
      const data = await cachedMobileApiRequest<any>('/settings', {
        forceRefresh: force,
        onRevalidate: (fresh) => setSettings(fresh),
      });
      setSettings(data);
    } catch (err: any) {
      console.warn('Settings load failed', err.message);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'PARTIES') loadParties();
    if (activeSection === 'WAREHOUSES') loadWarehouses();
    if (activeSection === 'STAFF') loadStaff();
    if (activeSection === 'SETTINGS') loadSettings();
  }, [activeSection, loadParties, loadWarehouses, loadStaff, loadSettings]);

  // Logout handler
  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from Dhra ERP?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/login');
          } catch (e: any) {
            console.error('Logout error:', e);
          }
        },
      },
    ]);
  };

  // WhatsApp Payment Reminder
  const handleSendPaymentReminder = (party: Party) => {
    const phone = cleanPhoneNumber(party.phone);
    const msg = `Dear ${party.name},\nGreetings from Shree Om Tiles & Sanitaryware.\nThis is a gentle reminder regarding your outstanding ledger balance. Kindly arrange payment via UPI or visit our showroom.\nThank you!`;
    const url = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp');
    });
  };

  // Zero-Out Warehouse Stock
  const handleZeroOutWarehouse = (wh: Warehouse) => {
    Alert.alert(
      'Zero-Out Stock',
      `DANGER: Are you sure you want to reset all inventory quantities in "${wh.name}" to 0? This action will be audited.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset to Zero',
          style: 'destructive',
          onPress: async () => {
            setZeroOutLoading(wh.id);
            try {
              await mobileApiRequest('/stock/zero-out', {
                method: 'POST',
                body: JSON.stringify({ warehouseId: wh.id }),
              });
              Alert.alert('Stock Reset', `All stock in "${wh.name}" has been cleared to 0.`);
              loadWarehouses(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not zero-out stock');
            } finally {
              setZeroOutLoading(null);
            }
          },
        },
      ],
    );
  };

  // Delete Warehouse
  const handleDeleteWarehouse = (wh: Warehouse) => {
    Alert.alert(
      'Delete Warehouse',
      `Are you sure you want to delete "${wh.name}"? This warehouse must have 0 stock and no active delivery trips.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleteWhLoading(wh.id);
            try {
              await mobileApiRequest(`/warehouses/${wh.id}`, {
                method: 'DELETE',
              });
              Alert.alert('Success', `Warehouse "${wh.name}" deleted.`);
              loadWarehouses(true);
            } catch (err: any) {
              Alert.alert('Cannot Delete Warehouse', err.message || 'Warehouse has inventory or active trips.');
            } finally {
              setDeleteWhLoading(null);
            }
          },
        },
      ],
    );
  };

  // Set Primary UPI Account
  const handleSetPrimaryUpi = async (upiAccId: string) => {
    try {
      await mobileApiRequest(`/settings/upi-accounts/${upiAccId}/primary`, {
        method: 'PATCH',
      });
      Alert.alert('Success', 'Default primary QR account updated');
      loadSettings(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to set primary UPI');
    }
  };

  // Delete Linked UPI Account
  const handleDeleteUpi = (upiAccId: string, vpa: string) => {
    Alert.alert(
      'Delete UPI Account',
      `Are you sure you want to unlink ${vpa}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileApiRequest(`/settings/upi-accounts/${upiAccId}`, {
                method: 'DELETE',
              });
              Alert.alert('Deleted', 'UPI account unlinked successfully');
              loadSettings(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove UPI account');
            }
          },
        },
      ],
    );
  };

  // Filtered parties
  const filteredParties = useMemo(() => {
    const q = partySearch.toLowerCase();
    return parties.filter((p) => {
      return (
        p.name?.toLowerCase().includes(q) ||
        p.phone?.includes(partySearch) ||
        (p.address && p.address.toLowerCase().includes(q))
      );
    });
  }, [parties, partySearch]);

  const defaultUpiId =
    settings?.upiId ||
    settings?.upiAccounts?.find((a: any) => a.isPrimary)?.upiId ||
    'Not Configured';

  return (
    <View style={styles.screen}>
      <Header
        title={
          activeSection === 'MENU'
            ? 'Management Hub'
            : activeSection === 'PARTIES'
            ? 'Customer Parties'
            : activeSection === 'STAFF'
            ? 'Staff Roster'
            : activeSection === 'WAREHOUSES'
            ? 'Warehouses & Showrooms'
            : 'Company Settings'
        }
        subtitle="Tools, Directory & Permissions"
        rightAction={
          activeSection !== 'MENU'
            ? {
                icon: 'chevron-back',
                onPress: () => setActiveSection('MENU'),
              }
            : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* ========================================================================= */}
        {/* VIEW 1: MENU OVERVIEW                                                     */}
        {/* ========================================================================= */}
        {activeSection === 'MENU' ? (
          <View>
            {/* User Profile Card */}
            <Card elevated style={styles.profileCard}>
              <View style={styles.profileRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user?.name || 'Staff User'}</Text>
                  <Text style={styles.userPhone}>Phone: {user?.phone}</Text>
                  <View style={styles.roleTag}>
                    <Text style={styles.roleTagText}>{user?.role || 'STAFF'}</Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* Menu Options */}
            <Text style={styles.menuSectionHeader}>ERP Management Hub</Text>

            {/* 1. Customer Parties */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection('PARTIES')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconCircle}>
                <Ionicons name="people-outline" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Customer & Supplier Parties</Text>
                <Text style={styles.menuItemSub}>
                  Customer directory, 360° statements & WhatsApp reminders
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.dark.textTertiary} />
            </TouchableOpacity>

            {/* 2. Warehouses & Showrooms (Owner/Admin only) */}
            {isOwner || isAdmin ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setActiveSection('WAREHOUSES')}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconCircle}>
                  <Ionicons name="business-outline" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Warehouses & Showrooms</Text>
                  <Text style={styles.menuItemSub}>
                    Manage stock locations, zero-out inventory & branch addresses
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.dark.textTertiary} />
              </TouchableOpacity>
            ) : null}

            {/* 3. Staff Management (Owner/Admin only) */}
            {isOwner || isAdmin ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setActiveSection('STAFF')}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconCircle}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Staff Roster & Permissions</Text>
                  <Text style={styles.menuItemSub}>
                    Manage salesmen, drivers & password resets
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.dark.textTertiary} />
              </TouchableOpacity>
            ) : null}

            {/* 4. Company & UPI Settings (Owner only) */}
            {isOwner ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setActiveSection('SETTINGS')}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconCircle}>
                  <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>UPI & Billing Settings</Text>
                  <Text style={styles.menuItemSub}>
                    Configure dynamic QR bank accounts & company profile
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.dark.textTertiary} />
              </TouchableOpacity>
            ) : null}

            {/* Sign Out Button */}
            <Button
              title="Sign Out of ERP"
              icon="log-out-outline"
              variant="danger"
              size="lg"
              onPress={handleLogout}
              style={{ marginTop: 28 }}
            />
          </View>
        ) : null}

        {/* ========================================================================= */}
        {/* VIEW 2: PARTIES DIRECTORY                                                 */}
        {/* ========================================================================= */}
        {activeSection === 'PARTIES' ? (
          <View>
            <View style={styles.actionHeaderRow}>
              <Text style={styles.sectionTitle}>Customer Directory ({parties.length})</Text>
              <Button
                title="+ Add Party"
                size="sm"
                variant="primary"
                onPress={() => setPartyModalOpen(true)}
              />
            </View>

            <SearchBar
              value={partySearch}
              onChangeText={setPartySearch}
              placeholder="Search customer by name, phone, address..."
              style={{ marginHorizontal: 0, marginBottom: 12 }}
            />

            {partiesLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 24 }} />
            ) : (
              filteredParties.map((p) => (
                <Card
                  key={p.id}
                  elevated
                  style={styles.partyCard}
                  onPress={() => setStatementParty(p)}
                >
                  <View style={styles.partyCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partyName}>{p.name}</Text>
                      <Text style={styles.partyPhoneText}>Phone: {p.phone}</Text>
                      {p.gstin ? <Text style={styles.gstinText}>GSTIN: {p.gstin}</Text> : null}
                      {p.address ? (
                        <Text style={styles.partyAddressText} numberOfLines={2}>
                          {p.address}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.dark.textTertiary} />
                  </View>

                  <View style={styles.partyActionsRow}>
                    <Button
                      title="Call"
                      icon="call"
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        const clean = cleanPhoneNumber(p.phone);
                        if (clean) Linking.openURL(`tel:${clean}`);
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Statement"
                      icon="document-text-outline"
                      size="sm"
                      variant="primary"
                      onPress={() => setStatementParty(p)}
                      style={{ flex: 1.2 }}
                    />
                    <Button
                      title="Reminder"
                      icon="logo-whatsapp"
                      size="sm"
                      variant="secondary"
                      onPress={() => handleSendPaymentReminder(p)}
                      style={{ flex: 1.2 }}
                    />
                  </View>
                </Card>
              ))
            )}
          </View>
        ) : null}

        {/* ========================================================================= */}
        {/* VIEW 3: STAFF ROSTER                                                      */}
        {/* ========================================================================= */}
        {activeSection === 'STAFF' ? (
          <View>
            <View style={styles.actionHeaderRow}>
              <Text style={styles.sectionTitle}>Staff Accounts ({staffList.length})</Text>
              <Button
                title="+ Add Staff"
                size="sm"
                variant="primary"
                onPress={() => setStaffModalOpen(true)}
              />
            </View>

            {staffLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 24 }} />
            ) : (
              staffList.map((st) => (
                <Card key={st.id} elevated style={styles.staffCard}>
                  <View style={styles.staffRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffName}>{st.name}</Text>
                      <Text style={styles.staffPhone}>{st.phone}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                        <View style={styles.roleBadge}>
                          <Text style={styles.roleBadgeText}>{st.role}</Text>
                        </View>
                        <StatusBadge status={st.active ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                      </View>
                    </View>

                    <Button
                      title="Reset Pass"
                      size="sm"
                      variant="outline"
                      onPress={() => setResetModalUser(st)}
                    />
                  </View>
                </Card>
              ))
            )}
          </View>
        ) : null}

        {/* ========================================================================= */}
        {/* VIEW 4: WAREHOUSES & SHOWROOMS                                            */}
        {/* ========================================================================= */}
        {activeSection === 'WAREHOUSES' ? (
          <View>
            <View style={styles.actionHeaderRow}>
              <Text style={styles.sectionTitle}>Warehouses & Showrooms ({warehouses.length})</Text>
              <Button
                title="+ Add Location"
                size="sm"
                variant="primary"
                onPress={() => {
                  setEditingWarehouse(null);
                  setWarehouseModalOpen(true);
                }}
              />
            </View>

            {warehousesLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 24 }} />
            ) : (
              warehouses.map((wh) => (
                <Card key={wh.id} elevated style={styles.warehouseCard}>
                  <View style={styles.warehouseHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.warehouseName}>{wh.name}</Text>
                      {wh.address ? (
                        <Text style={styles.warehouseAddress}>{wh.address}</Text>
                      ) : null}
                    </View>
                    <View
                      style={
                        wh.type === 'SHOWROOM' ? styles.showroomBadge : styles.warehouseBadge
                      }
                    >
                      <Text style={styles.typeBadgeText}>{wh.type}</Text>
                    </View>
                  </View>

                  <View style={styles.warehouseActionsRow}>
                    <Button
                      title="Edit"
                      icon="create-outline"
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        setEditingWarehouse(wh);
                        setWarehouseModalOpen(true);
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Zero-Out"
                      icon="warning-outline"
                      size="sm"
                      variant="secondary"
                      loading={zeroOutLoading === wh.id}
                      onPress={() => handleZeroOutWarehouse(wh)}
                      style={{ flex: 1.1 }}
                    />
                    <Button
                      title="Delete"
                      icon="trash-outline"
                      size="sm"
                      variant="danger"
                      loading={deleteWhLoading === wh.id}
                      onPress={() => handleDeleteWarehouse(wh)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
              ))
            )}
          </View>
        ) : null}

        {/* ========================================================================= */}
        {/* VIEW 5: SETTINGS                                                          */}
        {/* ========================================================================= */}
        {activeSection === 'SETTINGS' ? (
          settingsLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 24 }} />
          ) : (
            <View>
              <Card elevated style={styles.settingsCard}>
                <Text style={styles.settingsHeader}>Active Merchant Profile</Text>
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Merchant Name</Text>
                  <Text style={styles.settingVal}>
                    {settings?.merchantName || 'Shree Om Tiles'}
                  </Text>
                </View>
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Default QR UPI ID</Text>
                  <Text style={styles.settingVal}>
                    {defaultUpiId}
                  </Text>
                </View>
              </Card>

              <View style={styles.actionHeaderRow}>
                <Text style={styles.sectionTitle}>Linked UPI Accounts</Text>
                <Button
                  title="+ Add UPI ID"
                  size="sm"
                  variant="primary"
                  onPress={() => setUpiAccountModalOpen(true)}
                />
              </View>

              {(settings?.upiAccounts || []).map((acc: any, idx: number) => (
                <Card key={acc.id || idx} style={styles.upiCard}>
                  <View style={styles.summaryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.upiTitle}>{acc.merchantName || 'Bank Account'}</Text>
                      <Text style={styles.upiSub}>{acc.upiId}</Text>
                    </View>
                    {acc.isPrimary ? (
                      <View style={styles.primaryUpiBadge}>
                        <Text style={styles.primaryUpiText}>PRIMARY</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.upiActionsRow}>
                    {!acc.isPrimary ? (
                      <Button
                        title="Set Primary"
                        size="sm"
                        variant="outline"
                        onPress={() => handleSetPrimaryUpi(acc.id)}
                        style={{ flex: 1 }}
                      />
                    ) : null}
                    <Button
                      title="Delete"
                      icon="trash-outline"
                      size="sm"
                      variant="danger"
                      onPress={() => handleDeleteUpi(acc.id, acc.upiId)}
                      style={{ flex: acc.isPrimary ? 1 : 0.6 }}
                    />
                  </View>
                </Card>
              ))}
            </View>
          )
        ) : null}
      </ScrollView>

      {/* MODALS */}
      <PartyFormModal
        visible={partyModalOpen}
        onClose={() => setPartyModalOpen(false)}
        onSuccess={() => loadParties(true)}
      />

      <PartyStatementDrawer
        party={statementParty}
        onClose={() => setStatementParty(null)}
        onPartyDeleted={() => loadParties(true)}
      />

      <WarehouseFormModal
        visible={warehouseModalOpen}
        onClose={() => {
          setWarehouseModalOpen(false);
          setEditingWarehouse(null);
        }}
        onSuccess={() => loadWarehouses(true)}
        warehouse={editingWarehouse}
      />

      <StaffFormModal
        visible={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        onSuccess={() => loadStaff(true)}
      />

      <ResetPasswordModal
        user={resetModalUser}
        onClose={() => setResetModalUser(null)}
        onSuccess={() => loadStaff(true)}
      />

      <AddUpiModal
        visible={upiAccountModalOpen}
        onClose={() => setUpiAccountModalOpen(false)}
        onSuccess={() => loadSettings(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#16161A',
    marginBottom: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#09090B',
    fontSize: 18,
    fontWeight: '900',
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userPhone: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  roleTag: {
    backgroundColor: Colors.dark.secondary,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  menuSectionHeader: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
  },
  menuIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.dark.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  menuItemSub: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  partyCard: {
    padding: 14,
    marginBottom: 10,
  },
  partyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partyName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  partyPhoneText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  gstinText: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    marginTop: 1,
    fontFamily: 'monospace',
  },
  partyAddressText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    marginTop: 3,
  },
  partyActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  staffCard: {
    padding: 14,
    marginBottom: 10,
  },
  staffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  staffName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  staffPhone: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: Colors.dark.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  warehouseCard: {
    padding: 14,
    marginBottom: 10,
  },
  warehouseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  warehouseName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  warehouseAddress: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  showroomBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  warehouseBadge: {
    backgroundColor: Colors.dark.secondary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  warehouseActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  settingsCard: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#16161A',
  },
  settingsHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  settingLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  settingVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  upiCard: {
    padding: 14,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upiTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  upiSub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  primaryUpiBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  primaryUpiText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#10B981',
  },
  upiActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
});
