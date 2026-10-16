import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Colors } from '@/constants/theme';
import { Party } from './types';

interface CustomerSelectorProps {
  customerMode: 'existing' | 'new';
  onCustomerModeChange: (mode: 'existing' | 'new') => void;
  parties: Party[];
  selectedPartyId: string;
  onSelectedPartyChange: (partyId: string) => void;
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
            size={14}
            color={customerMode === 'existing' ? '#09090B' : Colors.dark.textSecondary}
          />
          <Text style={[styles.toggleText, customerMode === 'existing' && styles.toggleTextActive]}>
            Select Existing
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, customerMode === 'new' && styles.toggleBtnActive]}
          onPress={() => onCustomerModeChange('new')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="person-add-outline"
            size={14}
            color={customerMode === 'new' ? '#09090B' : Colors.dark.textSecondary}
          />
          <Text style={[styles.toggleText, customerMode === 'new' && styles.toggleTextActive]}>
            + Quick Add Party
          </Text>
        </TouchableOpacity>
      </View>

      {customerMode === 'existing' ? (
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
      ) : (
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
    gap: 6,
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
    fontSize: 12,
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
});
