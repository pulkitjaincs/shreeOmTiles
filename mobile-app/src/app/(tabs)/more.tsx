import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  BackHandler,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getInitials } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Party, PartiesDirectoryView } from '@/components/parties';
import { Warehouse, WarehousesDirectoryView } from '@/components/warehouses';
import { StockItem } from '@/components/stock/types';

import {
  StaffUser,
  StaffFormModal,
  ResetPasswordModal,
  AddUpiModal,
  StaffDirectoryView,
  CompanySettingsView,
} from '@/components/settings';
import { testLocalNotification, setupPushNotifications } from '@/lib/notifications';
import { DayBookView } from '@/components/day-book/DayBookView';
import { QuotationsView } from '@/components/quotations/QuotationsView';
import { PurchasesView } from '@/components/purchases/PurchasesView';
import { ExpensesView } from '@/components/expenses/ExpensesView';

export default function MoreScreen() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const isOwner = user?.role === 'OWNER';
  const isAdmin = user?.role === 'ADMIN';
  const isAccountant = user?.role === 'ACCOUNTANT';
  const isSalesman = user?.role === 'SALESMAN';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const canViewFinances = isOwner || isAdmin || isAccountant;

  const [activeSection, setActiveSection] = useState<
    'MENU' | 'PARTIES' | 'STAFF' | 'SETTINGS' | 'WAREHOUSES' | 'DAY_BOOK' | 'QUOTATIONS' | 'PURCHASES' | 'EXPENSES'
  >('MENU');

  // Handle hardware & gesture back button inside More screen
  useEffect(() => {
    const onBackPress = () => {
      if (activeSection !== 'MENU') {
        setActiveSection('MENU');
        return true; // prevent changing tab or exiting screen
      }
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [activeSection]);

  // Parties State
  const [parties, setParties] = useState<Party[]>([]);
  const [partiesLoading, setPartiesLoading] = useState(false);

  // Warehouses State
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  // Staff State
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
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

  // Load Warehouses & Live Stock
  const loadWarehouses = useCallback(async (force = false) => {
    setWarehousesLoading(true);
    try {
      const [whData, stockData] = await Promise.all([
        cachedMobileApiRequest<Warehouse[]>('/warehouses', {
          forceRefresh: force,
          onRevalidate: (fresh) => setWarehouses(fresh || []),
        }),
        cachedMobileApiRequest<any[]>('/stock', {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            const list = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
            setStocks(list);
          },
        }),
      ]);
      setWarehouses(whData || []);
      const stockList = Array.isArray(stockData) ? stockData : (stockData as any)?.data || [];
      setStocks(stockList);
    } catch (err: any) {
      console.warn('Warehouses load failed', err.message);
    } finally {
      setWarehousesLoading(false);
    }
  }, []);

  // Load Staff
  const loadStaff = useCallback(async (force = false) => {
    if (!isOwner) return;
    setStaffLoading(true);
    try {
      const data = await cachedMobileApiRequest<StaffUser[]>('/users', {
        forceRefresh: force,
        onRevalidate: (fresh) =>
          setStaffList(
            (fresh || []).map((entry: any) => ({
              ...entry,
              active: entry.isActive ?? entry.active ?? true,
            })),
          ),
      });
      setStaffList(
        (data || []).map((entry: any) => ({
          ...entry,
          active: entry.isActive ?? entry.active ?? true,
        })),
      );
    } catch (err: any) {
      console.warn('Staff load failed', err.message);
    } finally {
      setStaffLoading(false);
    }
  }, [isOwner]);

  const handleToggleStaff = async (staff: StaffUser) => {
    try {
      await mobileApiRequest(`/users/${staff.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !staff.active }),
      });
      await loadStaff(true);
    } catch (error: any) {
      Alert.alert('Could Not Update Staff', error.message || 'Please try again.');
    }
  };

  const handleDeleteStaff = (staff: StaffUser) => {
    Alert.alert('Delete Staff Member', `Permanently remove ${staff.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await mobileApiRequest(`/users/${staff.id}`, { method: 'DELETE' });
            await loadStaff(true);
          } catch (error: any) {
            Alert.alert('Could Not Delete Staff', error.message || 'Please try again.');
          }
        },
      },
    ]);
  };

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

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'PARTIES':
        return 'Customer Parties';
      case 'DAY_BOOK':
        return 'Daily Till Book';
      case 'QUOTATIONS':
        return 'Price Estimates';
      case 'PURCHASES':
        return 'Inward Purchases';
      case 'EXPENSES':
        return 'Business Expenses';
      case 'STAFF':
        return 'Staff Roster & Roles';
      case 'WAREHOUSES':
        return 'Warehouses & Showrooms';
      case 'SETTINGS':
        return 'Store & UPI Settings';
      default:
        return 'Management Hub';
    }
  };

  const getSectionSubtitle = () => {
    switch (activeSection) {
      case 'PARTIES':
        return 'Directory & Statements';
      case 'DAY_BOOK':
        return 'Cash reconciliation & till stream';
      case 'QUOTATIONS':
        return 'Quotations & 1-click invoice';
      case 'PURCHASES':
        return 'Vendor POs & stock increment';
      case 'EXPENSES':
        return 'Daily cash & digital outflows';
      case 'STAFF':
        return 'Team Permissions & Access';
      case 'WAREHOUSES':
        return 'Locations & Showroom Hubs';
      case 'SETTINGS':
        return 'Dynamic QR & Company Profile';
      default:
        return 'Tools, Directory & Permissions';
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title={getSectionTitle()}
        subtitle={getSectionSubtitle()}
        showBrand={activeSection === 'MENU'}
        onBack={activeSection !== 'MENU' ? () => setActiveSection('MENU') : undefined}
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

            {/* 2. Quotations / Estimates (Salesmen, Accountants, Admins, Owners) */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection('QUOTATIONS')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: '#3B82F6' }]}>
                <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Price Estimates (Quotations)</Text>
                <Text style={styles.menuItemSub}>
                  Browse quotations, download PDFs & 1-click invoice conversion
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.dark.textTertiary} />
            </TouchableOpacity>

            {/* 3. Daily Till Book (Day Book) */}
            {canViewFinances ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setActiveSection('DAY_BOOK')}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: '#10B981' }]}>
                  <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Daily Till Book (Day Book)</Text>
                  <Text style={styles.menuItemSub}>
                    Opening balance, live till cash & chronological reconciliation
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.dark.textTertiary} />
              </TouchableOpacity>
            ) : null}

            {/* 4. Inward Purchases */}
            {canViewFinances || isSupervisor ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setActiveSection('PURCHASES')}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: '#F59E0B' }]}>
                  <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>
                    {isSupervisor ? 'Inward Purchases & Goods' : 'Inward Purchases & Payables'}
                  </Text>
                  <Text style={styles.menuItemSub}>
                    {isSupervisor
                      ? 'Vendor purchase orders & incoming warehouse stock'
                      : 'Vendor purchase orders, inventory increment & debit notes'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.dark.textTertiary} />
              </TouchableOpacity>
            ) : null}

            {/* 5. Business Expenses */}
            {canViewFinances ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setActiveSection('EXPENSES')}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: '#EF4444' }]}>
                  <Ionicons name="cash-outline" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Business Expenses</Text>
                  <Text style={styles.menuItemSub}>
                    Daily overheads, rent, utilities & cash outflows
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.dark.textTertiary} />
              </TouchableOpacity>
            ) : null}

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

            {/* 3. Staff Management (Owner only) */}
            {isOwner ? (
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

            {/* 5. Device Push Notifications Card */}
            <View style={styles.notificationCard}>
              <View style={styles.notificationHeader}>
                <View style={styles.notificationIconWrap}>
                  <Ionicons name="notifications" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notificationTitle}>Device Push Notifications</Text>
                  <Text style={styles.notificationSub}>
                    Instant alerts for deliveries, cash collection & invoices
                  </Text>
                </View>
              </View>
              <View style={styles.notificationActionRow}>
                <TouchableOpacity
                  style={styles.testAlertBtn}
                  onPress={async () => {
                    const ok = await testLocalNotification();
                    if (!ok) {
                      Alert.alert(
                        'Notification Permission',
                        'Push alerts require notification permission on a physical device. Requesting permission now...',
                        [
                          {
                            text: 'Enable Alerts',
                            onPress: () => setupPushNotifications(),
                          },
                          { text: 'Cancel', style: 'cancel' },
                        ],
                      );
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="flash-outline" size={14} color="#D97706" />
                  <Text style={styles.testAlertBtnText}>Send Test Alert</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign Out Button */}
            <Button
              title="Sign Out of ERP"
              icon="log-out-outline"
              variant="danger"
              size="lg"
              onPress={handleLogout}
              style={{ marginTop: 20 }}
            />
          </View>
        ) : null}

        {/* ========================================================================= */}
        {/* VIEW 2: PARTIES DIRECTORY                                                 */}
        {/* ========================================================================= */}
        {activeSection === 'PARTIES' ? (
          <PartiesDirectoryView
            parties={parties}
            loading={partiesLoading}
            onRefresh={() => loadParties(true)}
            isOwnerOrAdmin={isOwner || isAdmin}
            isSalesman={user?.role === 'SALESMAN'}
          />
        ) : null}

        {/* ========================================================================= */}
        {/* VIEW 3: STAFF ROSTER                                                      */}
        {/* ========================================================================= */}
        {activeSection === 'STAFF' && isOwner ? (
          <StaffDirectoryView
            staffList={staffList}
            loading={staffLoading}
            onRefresh={() => loadStaff(true)}
            onAddStaff={() => {
              setEditingStaff(null);
              setStaffModalOpen(true);
            }}
            onEditStaff={(st) => {
              setEditingStaff(st);
              setStaffModalOpen(true);
            }}
            onResetPassword={(st) => setResetModalUser(st)}
            onToggleStatus={handleToggleStaff}
            onDeleteStaff={handleDeleteStaff}
          />
        ) : null}

        {/* ========================================================================= */}
        {/* VIEW 4: WAREHOUSES & SHOWROOMS                                            */}
        {/* ========================================================================= */}
        {activeSection === 'WAREHOUSES' ? (
          <WarehousesDirectoryView
            warehouses={warehouses}
            stocks={stocks}
            loading={warehousesLoading}
            onRefresh={() => loadWarehouses(true)}
            isOwnerOrAdmin={isOwner || isAdmin}
          />
        ) : null}

        {/* ========================================================================= */}
        {/* VIEW 5: SETTINGS                                                          */}
        {/* ========================================================================= */}
        {activeSection === 'SETTINGS' ? (
          <CompanySettingsView
            settings={settings}
            loading={settingsLoading}
            onRefresh={() => loadSettings(true)}
            user={user}
            onUpdateUser={updateUser}
            onOpenAddUpi={() => setUpiAccountModalOpen(true)}
            onSetPrimaryUpi={handleSetPrimaryUpi}
            onDeleteUpi={handleDeleteUpi}
          />
        ) : null}

        {/* ========================================================================= */}
        {/* VIEW 6: DAY BOOK                                                          */}
        {/* ========================================================================= */}
        {activeSection === 'DAY_BOOK' ? <DayBookView /> : null}

        {/* ========================================================================= */}
        {/* VIEW 7: QUOTATIONS                                                        */}
        {/* ========================================================================= */}
        {activeSection === 'QUOTATIONS' ? <QuotationsView /> : null}

        {/* ========================================================================= */}
        {/* VIEW 8: PURCHASES                                                         */}
        {/* ========================================================================= */}
        {activeSection === 'PURCHASES' ? <PurchasesView /> : null}

        {/* ========================================================================= */}
        {/* VIEW 9: EXPENSES                                                          */}
        {/* ========================================================================= */}
        {activeSection === 'EXPENSES' ? <ExpensesView /> : null}
      </ScrollView>

      {/* Settings & Staff Modals */}
      <StaffFormModal
        visible={staffModalOpen}
        onClose={() => {
          setStaffModalOpen(false);
          setEditingStaff(null);
        }}
        onSuccess={() => loadStaff(true)}
        staff={editingStaff}
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
    paddingBottom: 95,
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
  notificationCard: {
    backgroundColor: '#18181B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginTop: 4,
    marginBottom: 4,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  notificationSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  notificationActionRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  testAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  testAlertBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#D97706',
  },
});
