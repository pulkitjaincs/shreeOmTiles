import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { buildFullDeliveryManifestShareUrl } from '@/lib/whatsapp';
import { Delivery, DriverUser, DispatchSelectionItem, PushSuccessDialogData } from './types';

interface PushDeliveryModalProps {
  delivery: Delivery | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: (data?: PushSuccessDialogData) => void;
  drivers: DriverUser[];
}

export function PushDeliveryModal({
  delivery,
  visible,
  onClose,
  onSuccess,
  drivers,
}: PushDeliveryModalProps) {
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [transportCost, setTransportCost] = useState('');
  const [dispatchAmountToCollect, setDispatchAmountToCollect] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatchItems, setDispatchItems] = useState<DispatchSelectionItem[]>([]);
  const [submittingPush, setSubmittingPush] = useState(false);

  useEffect(() => {
    if (visible && delivery) {
      setSelectedDriverId(drivers[0]?.id || '');
      setVehicle('');
      setTransportCost('');
      setDispatchAmountToCollect(String(delivery.amountToCollect || 0));
      setDispatchNotes('');

      const rawItems = delivery.items || delivery.invoice?.items || [];
      const formatted: DispatchSelectionItem[] = rawItems.map((it: any) => ({
        invoiceItemId: it.invoiceItemId || it.id,
        productId: it.productId,
        productName: it.productName || it.product?.name || 'Item',
        unit: it.unit || it.product?.unit || 'units',
        warehouseId: it.warehouseId || it.warehouse?.id,
        warehouseName: it.warehouseName || it.warehouse?.name,
        warehouseAddress: it.warehouseAddress || it.warehouse?.address,
        batchNo: it.batchNo,
        maxQty: Number(it.qty || 1),
        dispatchQty: Number(it.qty || 1),
        selected: true,
      }));
      setDispatchItems(formatted);
    }
  }, [visible, delivery, drivers]);

  if (!delivery) return null;

  const handlePushDelivery = async () => {
    if (!selectedDriverId) {
      Alert.alert('Required', 'Please select a driver for dispatch');
      return;
    }

    const itemsToDispatch = dispatchItems
      .filter((i) => i.selected && i.dispatchQty > 0)
      .map((i) => ({
        invoiceItemId: i.invoiceItemId,
        productId: i.productId,
        productName: i.productName,
        unit: i.unit,
        warehouseName: i.warehouseName,
        warehouseAddress: i.warehouseAddress,
        batchNo: i.batchNo,
        qty: i.dispatchQty,
      }));

    if (itemsToDispatch.length === 0) {
      Alert.alert('Required', 'Please select at least one item to dispatch');
      return;
    }

    setSubmittingPush(true);
    try {
      const costNum = transportCost ? Number(transportCost) : 0;
      const toCollectNum = dispatchAmountToCollect ? Number(dispatchAmountToCollect) : Number(delivery.amountToCollect || 0);

      await mobileApiRequest(`/delivery/${delivery.id}/push`, {
        method: 'POST',
        body: JSON.stringify({
          driverId: selectedDriverId,
          vehicle: vehicle.trim() || undefined,
          transportCost: costNum,
          amountToCollect: dispatchAmountToCollect ? Number(dispatchAmountToCollect) : undefined,
          notes: dispatchNotes.trim() || undefined,
          items: itemsToDispatch,
        }),
      });

      const targetDriver = drivers.find((d) => d.id === selectedDriverId);
      const waUrl = buildFullDeliveryManifestShareUrl({
        ...delivery,
        amountToCollect: toCollectNum,
        driver: targetDriver ? { id: targetDriver.id, name: targetDriver.name, phone: targetDriver.phone } : delivery.driver,
        items: itemsToDispatch,
      });

      const dialogData: PushSuccessDialogData = {
        invoiceNo: delivery.invoice?.invoiceNo || '',
        driverName: targetDriver?.name || 'Driver',
        driverPhone: targetDriver?.phone || '',
        itemsCount: itemsToDispatch.length,
        amountToCollect: toCollectNum,
        transportCost: costNum,
        hasRemaining: itemsToDispatch.length < dispatchItems.length,
        waUrl,
      };

      onClose();
      onSuccess(dialogData);
    } catch (err: any) {
      Alert.alert('Dispatch Failed', err.message || 'Could not push delivery');
    } finally {
      setSubmittingPush(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Dispatch Order to Driver"
      subtitle={`Invoice #${delivery.invoice?.invoiceNo} • ${delivery.invoice?.party?.name}`}
      maxHeightPercent={0.92}
    >
      <View>
        <Select
          label="Select Available Driver"
          placeholder="Choose driver..."
          value={selectedDriverId}
          onChange={setSelectedDriverId}
          icon="car-outline"
          options={drivers.map((dr) => ({
            value: dr.id,
            label: dr.name,
            subLabel: dr.phone ? `Phone: ${dr.phone}` : undefined,
          }))}
        />

        {/* Line Items Partial Dispatch Checklist */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.modalSectionTitle}>
            Items to Dispatch ({dispatchItems.filter((i) => i.selected).length}/{dispatchItems.length})
          </Text>
          <TouchableOpacity
            onPress={() => {
              const allSelected = dispatchItems.every((i) => i.selected);
              setDispatchItems((prev) => prev.map((i) => ({ ...i, selected: !allSelected })));
            }}
          >
            <Text style={styles.toggleAllText}>
              {dispatchItems.every((i) => i.selected) ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>

        {dispatchItems.map((item, idx) => {
          const toggleSelection = () => {
            setDispatchItems((prev) =>
              prev.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it)),
            );
          };

          return (
            <Card
              key={idx}
              style={[styles.dispatchItemCard, !item.selected && styles.dispatchItemCardInactive]}
            >
              <View style={styles.dispatchItemRow}>
                <TouchableOpacity
                  style={styles.itemTapArea}
                  onPress={toggleSelection}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, item.selected && styles.checkboxDone]}>
                    {item.selected ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.dispatchItemName, !item.selected && styles.dispatchItemNameDim]}
                      numberOfLines={1}
                    >
                      {item.productName}
                    </Text>
                    <Text style={styles.dispatchItemSub} numberOfLines={1}>
                      From: {item.warehouseName || 'Warehouse'}{item.batchNo ? ` • Lot: ${item.batchNo}` : ''}
                    </Text>
                    <Text style={styles.dispatchItemMax}>
                      Max Available: {item.maxQty} {item.unit}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Quantity Stepper */}
                {item.selected ? (
                  <View style={styles.dispatchStepper}>
                    <TouchableOpacity
                      style={styles.dispatchStepBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => {
                        setDispatchItems((prev) =>
                          prev.map((it, i) =>
                            i === idx ? { ...it, dispatchQty: Math.max(1, it.dispatchQty - 1) } : it,
                          ),
                        );
                      }}
                    >
                      <Text style={styles.dispatchStepBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.dispatchStepVal}>{item.dispatchQty}</Text>
                    <TouchableOpacity
                      style={styles.dispatchStepBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => {
                        setDispatchItems((prev) =>
                          prev.map((it, i) =>
                            i === idx ? { ...it, dispatchQty: Math.min(it.maxQty, it.dispatchQty + 1) } : it,
                          ),
                        );
                      }}
                    >
                      <Text style={styles.dispatchStepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </Card>
          );
        })}

        <Input
          label="Vehicle Number / Transport Type"
          placeholder="e.g. Tata Ace (DL 1L A 1234)"
          value={vehicle}
          onChangeText={setVehicle}
        />

        <Input
          label="Transport Cost (Internal Pricing ₹)"
          placeholder="0"
          value={transportCost}
          onChangeText={setTransportCost}
          keyboardType="numeric"
        />

        <Input
          label="Amount to Collect from Customer (₹)"
          placeholder="0"
          value={dispatchAmountToCollect}
          onChangeText={setDispatchAmountToCollect}
          keyboardType="numeric"
        />

        <Input
          label="Dispatch Notes / Instructions"
          placeholder="e.g. Deliver before 2 PM, handle tiles carefully"
          value={dispatchNotes}
          onChangeText={setDispatchNotes}
        />

        <Button
          title={submittingPush ? 'Pushing Dispatch...' : 'Confirm Driver Dispatch'}
          onPress={handlePushDelivery}
          loading={submittingPush}
          variant="primary"
          size="lg"
          style={{ marginTop: 12 }}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  driverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginRight: 8,
  },
  driverChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  driverChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  driverChipTextActive: {
    color: '#09090B',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  toggleAllText: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '700',
  },
  dispatchItemCard: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
  },
  dispatchItemCardInactive: {
    opacity: 0.5,
  },
  dispatchItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemTapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  dispatchItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dispatchItemNameDim: {
    color: Colors.dark.textTertiary,
  },
  dispatchItemSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  dispatchItemMax: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 1,
  },
  dispatchStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.secondary,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dispatchStepBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.cardElevated,
  },
  dispatchStepBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  dispatchStepVal: {
    width: 30,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
