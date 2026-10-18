import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { mobileApiRequest, cachedMobileApiRequest, subscribeToAppSync } from '@/lib/api';
import { getCacheStats, clearMobileAppCache, CacheStats } from '@/lib/cache-manager';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SectionErrorBoundary } from '@/components/ui/SectionErrorBoundary';
import { getInitials } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { Party, PartiesDirectoryView } from '@/components/parties';
import { Warehouse } from '@/components/warehouses';

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
import { useTheme } from '@/lib/theme-context';

export default function MoreScreen() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const { themeMode, setThemeMode } = useTheme();
  const isDirector = user?.role === 'OWNER' || (user?.role as any) === 'DIRECTOR';
  const isAdmin = user?.role === 'ADMIN';
  const isAccountant = user?.role === 'ACCOUNTANT';
  const isSalesman = user?.role === 'SALESMAN';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const canViewFinances = isDirector || isAdmin || isAccountant;

  const [activeSection, setActiveSection] = useState<
    'MENU' | 'PARTIES' | 'STAFF' | 'SETTINGS' | 'DAY_BOOK' | 'QUOTATIONS' | 'PURCHASES' | 'EXPENSES'
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

  // Helper to safely unpack party list from raw array or enveloped API responses
  const extractPartyList = (data: any): Party[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.parties)) return data.parties;
    if (Array.isArray(data?.result)) return data.result;
    if (Array.isArray(data?.data?.parties)) return data.data.parties;
    return [];
  };

  // Parties State
  const [parties, setParties] = useState<Party[]>([]);
  const [partiesLoading, setPartiesLoading] = useState(false);
  const [partiesError, setPartiesError] = useState<string | null>(null);
  const partiesInFlightRef = React.useRef(false);
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      partiesInFlightRef.current = false;
    };
  }, []);

  // Warehouses State
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

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

  // Storage & Cache State
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheStatsLoading, setCacheStatsLoading] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const loadCacheStats = useCallback(async () => {
    setCacheStatsLoading(true);
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (err) {
      console.warn('[More] Failed to load cache stats:', err);
    } finally {
      setCacheStatsLoading(false);
    }
  }, []);

  const handleManualClearCache = () => {
    Alert.alert(
      'Clear Application Cache',
      'This will clear offline cached records and temporary invoice PDFs.\n\nYour login session will remain active. Do you wish to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            setClearingCache(true);
            try {
              const res = await clearMobileAppCache();
              await loadCacheStats();
              Alert.alert(
                'Cache Cleared',
                `Successfully cleared ${res.clearedKeysCount} cached records and temporary files. Active screens will revalidate with fresh data.`,
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clear cache');
            } finally {
              setClearingCache(false);
            }
          },
        },
      ],
    );
  };

  // Load Parties with graceful API fallback & inFlight protection
  const loadParties = useCallback(async (force = false) => {
    if (partiesInFlightRef.current && !force) return;
    partiesInFlightRef.current = true;
    if (isMountedRef.current) setPartiesLoading(true);

    try {
      let data: any;
      try {
        data = await cachedMobileApiRequest<any>('/parties?includeUnsaved=true', {
          forceRefresh: force,
          timeoutMs: 45000,
          onRevalidate: (fresh) => {
            if (!isMountedRef.current) return;
            const list = extractPartyList(fresh);
            if (list.length > 0) {
              setParties(list);
              setPartiesError(null);
            }
          },
        });
      } catch (primaryErr: any) {
        console.warn('[More] Primary parties load failed, trying fallback /parties:', primaryErr?.message);
        data = await cachedMobileApiRequest<any>('/parties', {
          forceRefresh: force,
          timeoutMs: 45000,
          onRevalidate: (fresh) => {
            if (!isMountedRef.current) return;
            const list = extractPartyList(fresh);
            if (list.length > 0) {
              setParties(list);
              setPartiesError(null);
            }
          },
        });
      }

      if (isMountedRef.current) {
        const list = extractPartyList(data);
        setParties(list);
        setPartiesError(null);
      }
    } catch (err: any) {
      console.warn('Parties load failed completely:', err?.message);
      if (isMountedRef.current) {
        setPartiesError(err?.message || 'Could not load customers. Please try again.');
      }
    } finally {
      partiesInFlightRef.current = false;
      if (isMountedRef.current) {
        setPartiesLoading(false);
      }
    }
  }, []);

  // Load Warehouses
  const loadWarehouses = useCallback(async (force = false) => {
    try {
      const whData = await cachedMobileApiRequest<Warehouse[]>('/warehouses', {
        forceRefresh: force,
        onRevalidate: (fresh) => {
          if (!isMountedRef.current) return;
          setWarehouses(fresh || []);
        },
      });
      if (isMountedRef.current) {
        setWarehouses(whData || []);
      }
    } catch (err: any) {
      console.warn('Warehouses load failed', err.message);
    }
  }, []);

  // Load Staff
  const loadStaff = useCallback(async (force = false) => {
    if (!isDirector) return;
    setStaffLoading(true);
    try {
      const data = await cachedMobileApiRequest<any>('/users', {
        forceRefresh: force,
        onRevalidate: (fresh) => {
          const list = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
          setStaffList(
            list.map((entry: any) => ({
              ...entry,
              active: entry.isActive ?? entry.active ?? true,
            })),
          );
        },
      });
      const list = Array.isArray(data) ? data : (data as any)?.data || [];
      setStaffList(
        list.map((entry: any) => ({
          ...entry,
          active: entry.isActive ?? entry.active ?? true,
        })),
      );
    } catch (err: any) {
      console.warn('Staff load failed', err.message);
    } finally {
      setStaffLoading(false);
    }
  }, [isDirector]);

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

  const activeSectionRef = React.useRef(activeSection);
  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'MENU') loadCacheStats();
    if (activeSection === 'PARTIES') loadParties();
    if (activeSection === 'PURCHASES') {
      loadParties();
      loadWarehouses();
    }
    if (activeSection === 'STAFF') loadStaff();
    if (activeSection === 'SETTINGS') loadSettings();
  }, [activeSection, loadCacheStats, loadParties, loadWarehouses, loadStaff, loadSettings]);

  // The mount effect above already loads the initial section; without this guard the
  // very first focus fired a second, duplicate load of the same (large) data.
  const skipInitialFocusRef = React.useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (skipInitialFocusRef.current) {
        skipInitialFocusRef.current = false;
        return;
      }
      const current = activeSectionRef.current;
      if (current === 'MENU') loadCacheStats();
      else if (current === 'PARTIES') loadParties();
      else if (current === 'PURCHASES') {
        loadParties();
        loadWarehouses();
      } else if (current === 'STAFF') loadStaff();
      else if (current === 'SETTINGS') loadSettings();
    }, [loadCacheStats, loadParties, loadWarehouses, loadStaff, loadSettings]),
  );

  useEffect(() => {
    if (activeSection !== 'PARTIES' && activeSection !== 'PURCHASES') {
      partiesInFlightRef.current = false;
      setPartiesLoading(false);
    }
  }, [activeSection]);

  const handleRefreshParties = useCallback(() => {
    void loadParties(true);
  }, [loadParties]);

  useEffect(() => {
    const unsubscribe = subscribeToAppSync(() => {
      const current = activeSectionRef.current;
      if (current === 'PARTIES') {
        void loadParties(true);
      } else if (current === 'PURCHASES') {
        void loadParties(true);
        void loadWarehouses(true);
      } else if (current === 'STAFF') {
        void loadStaff(true);
      } else if (current === 'SETTINGS') {
        void loadSettings(true);
      } else if (current === 'MENU') {
        void loadCacheStats();
      }
    });
    return () => unsubscribe();
  }, [loadParties, loadWarehouses, loadStaff, loadSettings, loadCacheStats]);

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
        return 'Customer & Supplier Parties';
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
      case 'SETTINGS':
        return 'Store & UPI Settings';
      default:
        return 'Management Hub';
    }
  };

  const getSectionSubtitle = () => {
    switch (activeSection) {
      case 'PARTIES':
        return 'Directory & 360° Statements';
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

      <SectionErrorBoundary key={activeSection} onReset={() => setActiveSection('MENU')}>
      {activeSection === 'PARTIES' ? (
        <View style={styles.partiesContainer}>
          <PartiesDirectoryView
            parties={parties}
            loading={partiesLoading}
            onRefresh={handleRefreshParties}
            isOwnerOrAdmin={isDirector || isAdmin}
            isSalesman={isSalesman}
            error={partiesError}
            onRetry={() => loadParties(true)}
          />
        </View>
      ) : (
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
                    <Text style={styles.roleTagText}>{user?.role === 'OWNER' ? 'DIRECTOR' : (user?.role || 'STAFF')}</Text>
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

            {/* 2. Quotations / Estimates (Salesmen, Accountants, Admins, Directors) */}
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


            {/* 3. Staff Management (Director only) */}
            {isDirector ? (
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

            {/* 4. Company & UPI Settings (Director only) */}
            {isDirector ? (
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

            {/* Appearance & Theme Mode Switcher */}
            <View style={styles.themeCard}>
              <View style={styles.themeHeader}>
                <View style={styles.themeIconWrap}>
                  <Ionicons name="color-palette-outline" size={18} color="#A855F7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.themeTitle}>App Appearance & Theme</Text>
                  <Text style={styles.themeSub}>
                    Choose between Light, Dark, or System mode
                  </Text>
                </View>
              </View>

              <View style={styles.themeSegmentRow}>
                {(['system', 'dark', 'light'] as const).map((mode) => {
                  const isActive = themeMode === mode;
                  const label = mode === 'system' ? 'System' : mode === 'dark' ? 'Dark Mode' : 'Light Mode';
                  const iconName = mode === 'system' ? 'phone-portrait-outline' : mode === 'dark' ? 'moon-outline' : 'sunny-outline';

                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.themeOptionBtn, isActive && styles.themeOptionBtnActive]}
                      onPress={() => void setThemeMode(mode)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={iconName as any}
                        size={14}
                        color={isActive ? '#09090B' : Colors.dark.textSecondary}
                      />
                      <Text style={[styles.themeOptionText, isActive && styles.themeOptionTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

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

            {/* 6. Storage & 7-Day Auto Cache Purge Card */}
            <View style={styles.cacheCard}>
              <View style={styles.cacheHeader}>
                <View style={styles.cacheIconWrap}>
                  <Ionicons name="server-outline" size={18} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cacheTitle}>App Storage & Cache</Text>
                  <Text style={styles.cacheSub}>
                    Auto-cleared every 7 days • Session strictly preserved
                  </Text>
                </View>
              </View>

              <View style={styles.cacheInfoRow}>
                <View style={styles.cacheInfoCol}>
                  <Text style={styles.cacheInfoLabel}>Cached Data</Text>
                  <Text style={styles.cacheInfoValue}>
                    {cacheStatsLoading ? '...' : `${cacheStats?.keysCount ?? 0} items (${cacheStats?.approxKb ?? 0} KB)`}
                  </Text>
                </View>
                <View style={styles.cacheInfoCol}>
                  <Text style={styles.cacheInfoLabel}>Last Cleaned</Text>
                  <Text style={styles.cacheInfoValue}>
                    {cacheStats?.lastCleanedText ?? 'Never'}
                  </Text>
                </View>
                <View style={styles.cacheInfoCol}>
                  <Text style={styles.cacheInfoLabel}>Next Auto-Clean</Text>
                  <Text style={styles.cacheInfoValue}>
                    {cacheStats ? `in ${cacheStats.nextCleanupDueDays}d` : 'In 7d'}
                  </Text>
                </View>
              </View>

              <View style={styles.cacheActionRow}>
                <TouchableOpacity
                  style={styles.clearCacheBtn}
                  onPress={handleManualClearCache}
                  disabled={clearingCache}
                  activeOpacity={0.7}
                >
                  {clearingCache ? (
                    <ActivityIndicator size="small" color="#10B981" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={14} color="#10B981" />
                      <Text style={styles.clearCacheBtnText}>Clear Cache Now</Text>
                    </>
                  )}
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
        {/* VIEW 3: STAFF ROSTER                                                      */}
        {/* ========================================================================= */}
        {activeSection === 'STAFF' && isDirector ? (
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
        {activeSection === 'PURCHASES' ? (
          <PurchasesView
            onRefreshStock={() => loadWarehouses(true)}
            warehouses={warehouses}
            parties={parties}
          />
        ) : null}

        {/* ========================================================================= */}
        {/* VIEW 9: EXPENSES                                                          */}
        {/* ========================================================================= */}
        {activeSection === 'EXPENSES' ? <ExpensesView /> : null}
      </ScrollView>
      )}
      </SectionErrorBoundary>

      {/* Settings & Staff Modals - conditionally mounted */}
      {staffModalOpen && (
        <StaffFormModal
          visible={staffModalOpen}
          onClose={() => {
            setStaffModalOpen(false);
            setEditingStaff(null);
          }}
          onSuccess={() => loadStaff(true)}
          staff={editingStaff}
        />
      )}

      {Boolean(resetModalUser) && (
        <ResetPasswordModal
          user={resetModalUser}
          onClose={() => setResetModalUser(null)}
          onSuccess={() => loadStaff(true)}
        />
      )}

      {upiAccountModalOpen && (
        <AddUpiModal
          visible={upiAccountModalOpen}
          onClose={() => setUpiAccountModalOpen(false)}
          onSuccess={() => loadSettings(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  partiesContainer: {
    flex: 1,
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
  cacheCard: {
    backgroundColor: '#18181B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginTop: 8,
    marginBottom: 4,
  },
  cacheHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cacheIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cacheTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cacheSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  cacheInfoRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'space-between',
    gap: 8,
  },
  cacheInfoCol: {
    flex: 1,
  },
  cacheInfoLabel: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cacheInfoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 2,
  },
  cacheActionRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  clearCacheBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  clearCacheBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#10B981',
  },
  themeCard: {
    backgroundColor: '#18181B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginTop: 14,
    marginBottom: 4,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  themeSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  themeSegmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  themeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 7,
  },
  themeOptionBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  themeOptionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  themeOptionTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
});
