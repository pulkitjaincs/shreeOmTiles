import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Warehouse } from './types';

interface ActiveLocationsModalProps {
  visible: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
}

export function ActiveLocationsModal({
  visible,
  onClose,
  warehouses,
}: ActiveLocationsModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={`Active Locations (${warehouses.length})`}
      subtitle="Configured warehouses and showrooms for counter stock deductions"
    >
      <View style={styles.container}>
        {warehouses.length > 0 ? (
          warehouses.map((warehouse) => {
            const isShowroom = warehouse.type === 'SHOWROOM';
            return (
              <Card key={warehouse.id} elevated style={styles.locationCard}>
                <View style={styles.cardRow}>
                  <View
                    style={[
                      styles.iconBox,
                      isShowroom ? styles.iconShowroom : styles.iconWarehouse,
                    ]}
                  >
                    <Ionicons
                      name={isShowroom ? 'storefront-outline' : 'business-outline'}
                      size={18}
                      color={isShowroom ? '#38BDF8' : '#818CF8'}
                    />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.locationName} numberOfLines={1}>
                      {warehouse.name}
                    </Text>
                    {warehouse.address ? (
                      <Text style={styles.locationAddress} numberOfLines={1}>
                        {warehouse.address}
                      </Text>
                    ) : (
                      <Text style={styles.locationAddress}>Address not registered</Text>
                    )}
                  </View>

                  <View
                    style={[
                      styles.typeBadge,
                      isShowroom ? styles.typeShowroom : styles.typeWarehouse,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeText,
                        isShowroom ? styles.typeTextShowroom : styles.typeTextWarehouse,
                      ]}
                    >
                      {warehouse.code || warehouse.type || 'Godown'}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No active warehouse or showroom locations found.</Text>
          </View>
        )}
      </View>
    </BottomSheetModal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      gap: 8,
      paddingTop: 4,
    },
    locationCard: {
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardElevated,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconShowroom: {
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(56, 189, 248, 0.25)',
    },
    iconWarehouse: {
      backgroundColor: 'rgba(129, 140, 248, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(129, 140, 248, 0.25)',
    },
    locationName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    locationAddress: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    typeShowroom: {
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      borderColor: 'rgba(56, 189, 248, 0.25)',
    },
    typeWarehouse: {
      backgroundColor: 'rgba(129, 140, 248, 0.12)',
      borderColor: 'rgba(129, 140, 248, 0.25)',
    },
    typeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    typeTextShowroom: {
      color: '#38BDF8',
    },
    typeTextWarehouse: {
      color: '#818CF8',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      gap: 8,
    },
    emptyText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
