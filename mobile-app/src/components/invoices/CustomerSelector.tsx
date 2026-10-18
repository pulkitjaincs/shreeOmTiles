import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Colors } from '@/constants/theme';
import { Party } from './types';

interface CustomerSelectorProps {
  customerMode: 'existing' | 'new' | 'cash_sale';
  onCustomerModeChange: (mode: 'existing' | 'new' | 'cash_sale') => void;
  parties: Party[];
  selectedPartyId: string;
  onSelectedPartyChange: (partyId: string) => void;
  billAddress?: string;
  onBillAddressChange?: (address: string) => void;
  partyBalance?: number;
  newPartyName: string;
  onNewPartyNameChange: (name: string) => void;
  newPartyPhone: string;
  onNewPartyPhoneChange: (phone: string) => void;
  newPartyGstin: string;
  onNewPartyGstinChange: (gstin: string) => void;
  newPartyAddress: string;
  onNewPartyAddressChange: (address: string) => void;
  saveNewParty: boolean;
  onSaveNewPartyChange: (save: boolean) => void;
}

export function CustomerSelector({
  customerMode,
  onCustomerModeChange,
  parties,
  selectedPartyId,
  onSelectedPartyChange,
  billAddress,
  onBillAddressChange,
  partyBalance,
  newPartyName,
  onNewPartyNameChange,
  newPartyPhone,
  onNewPartyPhoneChange,
  newPartyGstin,
  onNewPartyGstinChange,
  newPartyAddress,
  onNewPartyAddressChange,
  saveNewParty,
  onSaveNewPartyChange,
}: CustomerSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.modalSectionTitle}>1. Customer Information</Text>

      <View style={styles.tabToggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, customerMode === 'existing' && styles.toggleBtnActive]}
          onPress={() => onCustomerModeChange('existing')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people-outline"
            size={13}
            color={customerMode === 'existing' ? '#09090B' : Colors.dark.textSecondary}
          />
          <Text style={[styles.toggleText, customerMode === 'existing' && styles.toggleTextActive]}>
            Existing
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, customerMode === 'new' && styles.toggleBtnActive]}
          onPress={() => onCustomerModeChange('new')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="person-add-outline"
            size={13}
            color={customerMode === 'new' ? '#09090B' : Colors.dark.textSecondary}
          />
          <Text style={[styles.toggleText, customerMode === 'new' && styles.toggleTextActive]}>
            + Quick Add
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, customerMode === 'cash_sale' && styles.toggleBtnActive]}
          onPress={() => onCustomerModeChange('cash_sale')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="wallet-outline"
            size={13}
            color={customerMode === 'cash_sale' ? '#09090B' : Colors.dark.textSecondary}
          />
          <Text style={[styles.toggleText, customerMode === 'cash_sale' && styles.toggleTextActive]}>
            Cash Sale
          </Text>
        </TouchableOpacity>
      </View>

      {customerMode === 'existing' && (
        <View>
          <Select
            label="Select Customer"
            placeholder="Choose saved customer..."
            value={selectedPartyId}
            onChange={onSelectedPartyChange}
            searchable
            searchPlaceholder="Search customer name or phone..."
            icon="person-outline"
            options={parties.map((p) => ({
              value: p.id,
              label: p.name,
              subLabel: p.phone + (p.address ? ` • ${p.address}` : ''),
              badge: p.gstin ? 'GST' : undefined,
            }))}
          />

          {Boolean(selectedPartyId) && partyBalance !== undefined && (
            <View
              style={[
                styles.balanceCard,
                partyBalance > 0
                  ? styles.balanceCardDue
                  : partyBalance < 0
                  ? styles.balanceCardAdvance
                  : styles.balanceCardSettled,
              ]}
            >
              <Ionicons
                name={partyBalance > 0 ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                size={16}
                color={partyBalance > 0 ? '#F59E0B' : '#10B981'}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    styles.balanceCardTitle,
                    { color: partyBalance > 0 ? '#F59E0B' : '#10B981' },
                  ]}
                >
                  {partyBalance > 0
                    ? 'Prior Unsettled Dues'
                    : partyBalance < 0
                    ? 'Advance Party Credit'
                    : 'All Prior Dues Settled'}
                </Text>
                <Text style={styles.balanceCardDesc}>
                  {partyBalance !== 0
                    ? `₹${Math.abs(partyBalance).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })} (Informational context)`
                    : '₹0.00 outstanding balance'}
                </Text>
              </View>
            </View>
          )}

          {Boolean(selectedPartyId) && onBillAddressChange && (
            <Input
              label="Delivery / Site Address (Per Bill)"
              placeholder="Enter custom delivery address for this bill..."
              value={billAddress ?? ''}
              onChangeText={onBillAddressChange}
            />
          )}
        </View>
      )}

      {customerMode === 'new' && (
        <View>
          <Input
            label="Customer / Firm Name"
            placeholder="e.g. Ramesh Tiles Depot"
            value={newPartyName}
            onChangeText={onNewPartyNameChange}
          />
          <Input
            label="Mobile Number (10 digits)"
            placeholder="e.g. 9876543210"
            value={newPartyPhone}
            onChangeText={(t) => onNewPartyPhoneChange(t.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
          />
          <Input
            label="GSTIN (Optional)"
            placeholder="e.g. 07AAAAA0000A1Z5"
            value={newPartyGstin}
            onChangeText={(t) => onNewPartyGstinChange(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={15}
          />
          <Input
            label="Delivery Address (Optional)"
            placeholder="e.g. Shop 4, Market Road"
            value={newPartyAddress}
            onChangeText={onNewPartyAddressChange}
          />
          <TouchableOpacity
            style={styles.savePartyRow}
            onPress={() => onSaveNewPartyChange(!saveNewParty)}
          >
            <Ionicons
              name={saveNewParty ? 'checkbox' : 'square-outline'}
              size={20}
              color={saveNewParty ? '#10B981' : Colors.dark.textSecondary}
            />
            <Text style={styles.savePartyText}>Save this customer to the party directory</Text>
          </TouchableOpacity>
        </View>
      )}

      {customerMode === 'cash_sale' && (
        <View>
          <View style={styles.cashSaleBanner}>
            <Ionicons name="storefront-outline" size={16} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.cashSaleBannerTitle}>Cash Sale • Counter Pickup</Text>
              <Text style={styles.cashSaleBannerSub}>
                Customer pickup by default. Will not be sent to delivery dispatch.
              </Text>
            </View>
          </View>
          <Input
            label="Customer Name (Optional)"
            placeholder="e.g. Walk-in / Cash Customer"
            value={newPartyName}
            onChangeText={onNewPartyNameChange}
          />
          <Input
            label="Mobile Number (Optional)"
            placeholder="e.g. 9876543210 (Optional)"
            value={newPartyPhone}
            onChangeText={(t) => onNewPartyPhoneChange(t.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
          />
          <Input
            label="Address / Site Note (Optional)"
            placeholder="e.g. Counter Pickup / Local Delivery"
            value={billAddress ?? newPartyAddress}
            onChangeText={(t) => {
              if (onBillAddressChange) onBillAddressChange(t);
              onNewPartyAddressChange(t);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 14,
    marginBottom: 8,
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 3,
    marginBottom: 10,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
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
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  toggleTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  savePartyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  savePartyText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 8,
  },
  balanceCardDue: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  balanceCardAdvance: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  balanceCardSettled: {
    borderColor: 'rgba(16, 185, 129, 0.2)',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  balanceCardTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  balanceCardDesc: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  cashSaleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    marginBottom: 10,
  },
  cashSaleBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
  },
  cashSaleBannerSub: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
});
