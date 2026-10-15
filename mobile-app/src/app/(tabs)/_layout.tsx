import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const role = user?.role || 'SALESMAN';

  const isDriver = role === 'DRIVER';
  const isSalesman = role === 'SALESMAN';
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.dark.background,
          borderTopColor: Colors.dark.border,
          borderTopWidth: 1,
          height: 52 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: Colors.dark.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '700',
          letterSpacing: 0.1,
          marginTop: 2,
        },
      }}
    >
      {/* 1. Dashboard / Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: isDriver ? 'My Run' : isSalesman ? 'My Sales' : 'Analytics',
          tabBarLabel: isDriver ? 'My Run' : 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              color={color}
              size={size - 2}
            />
          ),
        }}
      />

      {/* 2. Invoices & Billing Tab */}
      <Tabs.Screen
        name="invoices"
        options={{
          href: isDriver ? null : undefined,
          title: isSalesman ? 'Counter Billing' : 'Invoices',
          tabBarLabel: isSalesman ? 'Billing' : 'Invoices',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'receipt' : 'receipt-outline'}
              color={color}
              size={size - 2}
            />
          ),
        }}
      />

      {/* 3. Deliveries & Dispatch Tab */}
      <Tabs.Screen
        name="deliveries"
        options={{
          href: isSalesman ? null : undefined,
          title: isDriver ? 'Deliveries' : 'Dispatch',
          tabBarLabel: 'Deliveries',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'bicycle' : 'bicycle-outline'}
              color={color}
              size={size - 1}
            />
          ),
        }}
      />

      {/* 4. Live Stock & Warehouses Tab */}
      <Tabs.Screen
        name="stock"
        options={{
          href: isDriver ? null : undefined,
          title: 'Stock & Inventory',
          tabBarLabel: 'Stock',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'cube' : 'cube-outline'}
              color={color}
              size={size - 2}
            />
          ),
        }}
      />

      {/* 5. Transactions Tab (Owner/Admin) */}
      <Tabs.Screen
        name="transactions"
        options={{
          href: isOwnerOrAdmin ? undefined : null,
          title: 'Transactions',
          tabBarLabel: 'Payments',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'swap-horizontal' : 'swap-horizontal-outline'}
              color={color}
              size={size - 1}
            />
          ),
        }}
      />

      {/* 6. More Hub Tab (Staff, Parties, Settings) */}
      <Tabs.Screen
        name="more"
        options={{
          title: 'More Tools',
          tabBarLabel: 'More',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'}
              color={color}
              size={size - 2}
            />
          ),
        }}
      />
    </Tabs>
  );
}
