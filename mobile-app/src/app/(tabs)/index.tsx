import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { cachedMobileApiRequest, mobileApiRequest, subscribeToAppSync } from '@/lib/api';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Header } from '@/components/ui/Header';
import { cleanPhoneNumber } from '@/lib/formatters';
import { useRouter, useFocusEffect } from 'expo-router';

import { DriverDashboardView } from '@/components/dashboard/DriverDashboardView';
import { SalesmanDashboardView } from '@/components/dashboard/SalesmanDashboardView';
import { OwnerDashboardView } from '@/components/dashboard/OwnerDashboardView';
import { SupervisorDashboardView } from '@/components/dashboard/SupervisorDashboardView';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const role = user?.role || 'SALESMAN';

  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      screen: {
        flex: 1,
        backgroundColor: c.background,
      },
      center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      },
      loadingText: {
        color: c.textSecondary,
        fontSize: 12,
        marginTop: 10,
      },
    })
  );

  const isDriver = role === 'DRIVER';
  const isSalesman = role === 'SALESMAN';
  const isSupervisor = role === 'SUPERVISOR';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preset, setPreset] = useState<'today' | '7d' | '30d' | 'month' | 'all' | 'custom'>('today');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');

  // Analytics data for Director/Admin and Salesman
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  // Driver active deliveries
  const [driverDeliveries, setDriverDeliveries] = useState<any[]>([]);
  const [handoverInProgress, setHandoverInProgress] = useState<string | null>(null);

  const loadData = useCallback(async (force = false) => {
    try {
      if (isSupervisor) {
        // Supervisor uses their own scoped data in SupervisorDashboardView
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (isDriver) {
        const deliveries = await cachedMobileApiRequest<any[]>('/delivery', {
          forceRefresh: force,
          onRevalidate: (fresh) => setDriverDeliveries(fresh || []),
        });
        setDriverDeliveries(deliveries || []);
      } else {
        if (preset === 'custom' && (!appliedDateFrom || !appliedDateTo)) {
          setAnalyticsData(null);
          return;
        }
        const query = preset === 'custom' ? `preset=custom&from=${encodeURIComponent(appliedDateFrom)}&to=${encodeURIComponent(appliedDateTo)}` : `preset=${preset}`;
        const data = await cachedMobileApiRequest<any>(
          `/analytics/dashboard?${query}`,
          {
            forceRefresh: force,
            onRevalidate: (fresh) => setAnalyticsData(fresh),
          },
        );
        setAnalyticsData(data);
      }
    } catch (err: any) {
      console.warn('Dashboard load error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSupervisor, isDriver, preset, appliedDateFrom, appliedDateTo]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    const unsubscribe = subscribeToAppSync(() => {
      void loadData();
    });
    return () => unsubscribe();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Driver quick action: Call customer
  const handleCall = (phone?: string) => {
    const clean = cleanPhoneNumber(phone);
    if (clean) {
      Linking.openURL(`tel:${clean}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call');
      });
    }
  };

  // Driver quick action: Open Google Maps
  const handleMap = (address?: string) => {
    if (address) {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      ).catch(() => {
        Alert.alert('Error', 'Unable to open maps');
      });
    }
  };

  // Director/Admin: Handover Cash Approval
  const handleVerifyHandover = async (deliveryId: string) => {
    Alert.alert(
      'Verify Cash Handover',
      'Confirm you have physically received this cash at the counter? This will update the invoice to PAID and settle the credit ledger.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Clear Custody',
          onPress: async () => {
            setHandoverInProgress(deliveryId);
            try {
              await mobileApiRequest(`/delivery/${deliveryId}/handover-cash`, {
                method: 'PATCH',
                body: JSON.stringify({}),
              });
              Alert.alert('Success', 'Cash verified! Custody cleared and payment recorded.');
              loadData(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to verify handover');
            } finally {
              setHandoverInProgress(null);
            }
          },
        },
      ],
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.screen}>
        <Header title="Shree Om Tiles" />
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={styles.loadingText}>Loading dashboard metrics...</Text>
        </View>
      </View>
    );
  }

  if (isSupervisor) {
    return (
      <SupervisorDashboardView
        user={user}
        refreshing={refreshing}
        onRefresh={onRefresh}
        router={router}
      />
    );
  }

  if (isDriver) {
    return (
      <DriverDashboardView
        user={user}
        refreshing={refreshing}
        onRefresh={onRefresh}
        driverDeliveries={driverDeliveries}
        router={router}
        handleCall={handleCall}
        handleMap={handleMap}
      />
    );
  }

  if (isSalesman) {
    return (
      <SalesmanDashboardView
        user={user}
        analyticsData={analyticsData}
        preset={preset}
        setPreset={setPreset}
        dateFrom={dateFrom}
        dateTo={dateTo}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        onApplyDateRange={() => { setAppliedDateFrom(dateFrom); setAppliedDateTo(dateTo); }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        router={router}
      />
    );
  }

  return (
    <OwnerDashboardView
      analyticsData={analyticsData}
      preset={preset}
      setPreset={setPreset}
      dateFrom={dateFrom}
      dateTo={dateTo}
      setDateFrom={setDateFrom}
      setDateTo={setDateTo}
      onApplyDateRange={() => { setAppliedDateFrom(dateFrom); setAppliedDateTo(dateTo); }}
      refreshing={refreshing}
      onRefresh={onRefresh}
      handoverInProgress={handoverInProgress}
      handleVerifyHandover={handleVerifyHandover}
      router={router}
    />
  );
}
