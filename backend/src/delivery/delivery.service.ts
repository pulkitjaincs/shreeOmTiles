import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDeliveryDto,
  CreateTripDto,
  PushDeliveryDto,
} from './dto/create-delivery.dto';
import {
  DeliveryStatus,
  Prisma,
  PaymentMode,
  PaymentStatus,
  InvoiceStatus,
  CreditStatus,
  CreditType,
  PaymentType,
} from '@prisma/client';
import { PaginationParams } from '../common/interfaces/pagination.interface';

import { NotificationsService } from '../notifications/notifications.service';

interface DeliveryItemPayload {
  invoiceItemId?: string;
  productId?: string;
  productName?: string;
  unit?: string;
  warehouseId?: string;
  batchNo?: string;
  qty?: number;
  pickedUp?: boolean;
  pickedUpAt?: string;
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(data: CreateDeliveryDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      include: {
        items: { include: { product: true, warehouse: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (data.driverId) {
      const existingCustomerPickup = await this.prisma.delivery.findFirst({
        where: {
          invoiceId: data.invoiceId,
          OR: [
            { status: DeliveryStatus.DELIVERED, driverId: null },
            { notes: { contains: 'Customer Picked Up', mode: 'insensitive' } },
            { notes: { contains: 'Self-Pickup', mode: 'insensitive' } },
            { notes: { contains: 'Counter Pickup', mode: 'insensitive' } },
          ],
        },
      });
      if (existingCustomerPickup) {
        throw new BadRequestException(
          'Customer has already picked up items for this invoice. Driver assignment is strictly blocked.',
        );
      }
    }

    const defaultItems = invoice.items.map((it) => ({
      invoiceItemId: it.id,
      productId: it.productId,
      productName: it.product?.name || 'Product',
      unit: it.product?.unit || 'unit',
      warehouseId: it.warehouseId,
      warehouseName: it.warehouse?.name || 'Warehouse',
      warehouseAddress: it.warehouse?.address || '',
      batchNo: it.batchNo,
      qty: it.qty,
      pickedUp: false,
    }));

    return this.prisma.delivery.create({
      data: {
        invoiceId: data.invoiceId,
        driverId: data.driverId,
        status: DeliveryStatus.PENDING,
        notes: data.notes,
        items: defaultItems,
      },
      include: {
        invoice: { include: { party: true } },
        driver: { select: { id: true, name: true, phone: true } },
      },
    });
  }

  async findAll(
    driverId?: string,
    isDriverRole: boolean = false,
    pagination?: PaginationParams,
  ): Promise<any> {
    const where: Prisma.DeliveryWhereInput = {};
    if (driverId) {
      where.driverId = driverId;
    }

    // Driver rule: deliveries appear to a driver once assigned/pushed (not unassigned PENDING)
    if (isDriverRole) {
      where.status = {
        notIn: [DeliveryStatus.PENDING],
      };
    }

    const includeRelations = {
      invoice: {
        include: {
          party: {
            select: {
              id: true,
              name: true,
              phone: true,
              address: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  unit: true,
                },
              },
              warehouse: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                },
              },
            },
          },
        },
      },
      driver: { select: { id: true, name: true, phone: true } },
      trips: true,
    };

    type DeliveryWithRelations = Prisma.DeliveryGetPayload<{
      include: typeof includeRelations;
    }>;

    const normalizeItems = (deliveries: DeliveryWithRelations[]) =>
      deliveries.map((d) => {
        const rawItems = Array.isArray(d.items)
          ? (d.items as unknown as DeliveryItemPayload[])
          : [];
        const parsedItems =
          rawItems.length > 0
            ? rawItems
            : d.invoice.items.map((it) => ({
                invoiceItemId: it.id,
                productId: it.productId,
                productName: it.product?.name || 'Product',
                unit: it.product?.unit || 'unit',
                warehouseId: it.warehouseId || undefined,
                warehouseName: it.warehouse?.name || 'Warehouse',
                warehouseAddress: it.warehouse?.address || '',
                batchNo: it.batchNo || undefined,
                qty: it.qty,
                pickedUp: false,
              }));
        return {
          ...d,
          items: parsedItems,
        };
      });

    if (pagination?.page !== undefined || pagination?.limit !== undefined) {
      const page = Math.max(1, pagination?.page || 1);
      const limit = Math.min(Math.max(1, pagination?.limit || 25), 100);
      const skip = (page - 1) * limit;

      const [deliveries, total] = await Promise.all([
        this.prisma.delivery.findMany({
          where,
          include: includeRelations,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.delivery.count({ where }),
      ]);

      return {
        data: normalizeItems(deliveries),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const deliveries = await this.prisma.delivery.findMany({
      where,
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Normalize items: if delivery has specific items saved, use those; else fallback to invoice items
    return normalizeItems(deliveries);
  }

  async findOne(id: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            party: true,
            items: { include: { product: true, warehouse: true } },
          },
        },
        driver: { select: { id: true, name: true, phone: true } },
        trips: true,
      },
    });
    if (!delivery) throw new NotFoundException(`Delivery ${id} not found`);

    const parsedItems =
      Array.isArray(delivery.items) && (delivery.items as any[]).length > 0
        ? (delivery.items as any[])
        : delivery.invoice.items.map((it) => ({
            invoiceItemId: it.id,
            productId: it.productId,
            productName: it.product?.name || 'Product',
            unit: it.product?.unit || 'unit',
            warehouseId: it.warehouseId,
            warehouseName: it.warehouse?.name || 'Warehouse',
            warehouseAddress: it.warehouse?.address || '',
            batchNo: it.batchNo,
            qty: it.qty,
            pickedUp: false,
          }));

    return {
      ...delivery,
      items: parsedItems,
    };
  }

  private isCustomerPickedUp(delivery: {
    status: DeliveryStatus;
    driverId?: string | null;
    notes?: string | null;
  }): boolean {
    if (delivery.status === DeliveryStatus.DELIVERED && !delivery.driverId) {
      return true;
    }
    if (
      delivery.notes &&
      /customer\s*picked\s*up|self-pickup|counter\s*pickup/i.test(
        delivery.notes,
      )
    ) {
      return true;
    }
    return false;
  }

  async updateStatus(id: string, status: DeliveryStatus, notes?: string) {
    const delivery = await this.findOne(id);

    const isMarkingCustomerPickup =
      Boolean(
        notes &&
        /customer\s*picked\s*up|self-pickup|counter\s*pickup/i.test(notes),
      ) ||
      (status === DeliveryStatus.DELIVERED && !delivery.driverId);

    if (
      this.isCustomerPickedUp(delivery) &&
      status !== DeliveryStatus.DELIVERED
    ) {
      throw new BadRequestException(
        'Order was already picked up by customer. Modifying status or assigning driver is strictly blocked.',
      );
    }

    // When customer picks up, mark all items as pickedUp: true and disassociate any driver
    let updatedItems = delivery.items;
    if (isMarkingCustomerPickup && Array.isArray(delivery.items)) {
      updatedItems = (delivery.items as unknown as DeliveryItemPayload[]).map(
        (it) => ({
          ...it,
          pickedUp: true,
          pickedUpAt: it.pickedUpAt || new Date().toISOString(),
        }),
      );
    }

    const updated = await this.prisma.delivery.update({
      where: { id },
      data: {
        status,
        ...(isMarkingCustomerPickup
          ? { driverId: null, items: updatedItems }
          : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      include: { driver: true, invoice: { include: { party: true } } },
    });

    if (status === DeliveryStatus.DELIVERED) {
      const customerName = updated.invoice?.party?.name || 'Customer';
      const invoiceNo = updated.invoice?.invoiceNo || 'Order';
      const byWhom = isMarkingCustomerPickup
        ? 'Customer counter pickup'
        : `Driver ${updated.driver?.name || 'Driver'}`;

      void this.notifications.notifyAdmins(
        'Delivery Completed',
        `Invoice #${invoiceNo} for ${customerName} delivered (${byWhom}).`,
        { type: 'DELIVERY_COMPLETED', deliveryId: id, invoiceId: updated.invoiceId },
      );
    } else if (status === DeliveryStatus.CANCELLED) {
      const customerName = updated.invoice?.party?.name || 'Customer';
      const invoiceNo = updated.invoice?.invoiceNo || 'Order';
      const reasonText = notes ? ` Reason: ${notes}` : '';

      void this.notifications.notifyAdmins(
        'Delivery Cancelled',
        `Delivery for Invoice #${invoiceNo} (${customerName}) was cancelled.${reasonText}`,
        { type: 'DELIVERY_CANCELLED', deliveryId: id, invoiceId: updated.invoiceId },
      );
    }

    return updated;
  }

  async assignDriver(id: string, driverId: string) {
    const delivery = await this.findOne(id);

    if (
      this.isCustomerPickedUp(delivery) ||
      delivery.status === DeliveryStatus.DELIVERED
    ) {
      throw new BadRequestException(
        'Order was picked up by customer (or already delivered). Driver assignment is strictly blocked.',
      );
    }

    if (driverId) {
      const driver = await this.prisma.user.findUnique({
        where: { id: driverId },
      });
      if (!driver || !driver.isActive) {
        throw new BadRequestException(
          'Selected driver is inactive. Cannot assign deliveries to inactive staff.',
        );
      }
    }
    // If driver is cleared (null), revert to PENDING
    // If assigning while PENDING, keep as PENDING until owner/admin pushes the delivery
    // If delivery is already ASSIGNED (pushed), OUT_FOR_PICKUP, etc., retain that status
    const newStatus = !driverId ? DeliveryStatus.PENDING : delivery.status;
    return this.prisma.delivery.update({
      where: { id },
      data: {
        driverId: driverId || null,
        status: newStatus,
      },
      include: { driver: true, invoice: true },
    });
  }

  async addTrip(deliveryId: string, tripDto: CreateTripDto) {
    const delivery = await this.findOne(deliveryId);
    const tripCount = delivery.trips.length;

    return this.prisma.deliveryTrip.create({
      data: {
        deliveryId,
        tripNo: tripCount + 1,
        vehicle: tripDto.vehicle,
        cost: new Prisma.Decimal((tripDto.cost || 0).toFixed(2)),
        notes: tripDto.notes,
      },
    });
  }

  async pushDelivery(id: string, dto: PushDeliveryDto) {
    const delivery = await this.findOne(id);

    if (
      this.isCustomerPickedUp(delivery) ||
      delivery.status === DeliveryStatus.DELIVERED
    ) {
      throw new BadRequestException(
        'Order was picked up by customer (or already delivered). Driver dispatch is strictly blocked.',
      );
    }

    const effectiveDriverId = dto.driverId || delivery.driverId;
    if (!effectiveDriverId) {
      throw new BadRequestException(
        'A driver must be assigned before pushing delivery',
      );
    }
    const driver = await this.prisma.user.findUnique({
      where: { id: effectiveDriverId },
    });
    if (!driver || !driver.isActive) {
      throw new BadRequestException(
        'Assigned driver is inactive. Cannot push delivery to inactive staff.',
      );
    }

    // 1. Determine dispatched items for this delivery (each item starts with pickedUp: false)
    const defaultItems = delivery.invoice.items.map((it) => ({
      invoiceItemId: it.id,
      productId: it.productId,
      productName: it.product?.name || 'Product',
      unit: it.product?.unit || 'unit',
      warehouseId: it.warehouseId,
      warehouseName: it.warehouse?.name || 'Warehouse',
      warehouseAddress: it.warehouse?.address || '',
      batchNo: it.batchNo,
      qty: it.qty,
      pickedUp: false,
    }));

    const dispatchedItems =
      dto.items && dto.items.length > 0
        ? dto.items.map((it) => ({ ...it, pickedUp: false }))
        : defaultItems;

    // 2. Execute all dispatch modifications atomically inside a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Record internal transport pricing as a trip
      await tx.deliveryTrip.create({
        data: {
          deliveryId: id,
          tripNo: delivery.trips.length + 1,
          vehicle: dto.vehicle || dto.vehicleNo || undefined,
          cost: new Prisma.Decimal((dto.transportCost || 0).toFixed(2)),
          notes:
            dto.notes || 'Internal transport pricing recorded on dispatch push',
        },
      });

      // Transition this delivery status to ASSIGNED with amountToCollect and dispatched items
      const updatedDelivery = await tx.delivery.update({
        where: { id },
        data: {
          status: DeliveryStatus.ASSIGNED,
          driverId: effectiveDriverId,
          items: dispatchedItems,
          amountToCollect:
            dto.amountToCollect !== undefined
              ? new Prisma.Decimal((dto.amountToCollect || 0).toFixed(2))
              : delivery.amountToCollect,
        },
        include: {
          invoice: {
            include: {
              party: true,
              items: { include: { product: true, warehouse: true } },
            },
          },
          driver: { select: { id: true, name: true, phone: true } },
          trips: true,
        },
      });

      // Calculate remaining items across the invoice
      const activeDeliveries = await tx.delivery.findMany({
        where: {
          invoiceId: delivery.invoiceId,
          status: {
            in: [
              DeliveryStatus.ASSIGNED,
              DeliveryStatus.OUT_FOR_PICKUP,
              DeliveryStatus.PICKED_UP,
              DeliveryStatus.OUT_FOR_DELIVERY,
              DeliveryStatus.DELIVERED,
            ],
          },
        },
      });

      // Calculate sum of dispatched quantities
      const dispatchedQtyByItem: Record<string, number> = {};
      for (const d of activeDeliveries) {
        const rawItems = Array.isArray(d.items) ? d.items : [];
        const itemsList = rawItems as unknown as DeliveryItemPayload[];
        for (const item of itemsList) {
          const key =
            item.invoiceItemId ||
            `${item.productId || ''}-${item.warehouseId || ''}-${item.batchNo || ''}`;
          dispatchedQtyByItem[key] =
            (dispatchedQtyByItem[key] || 0) + Number(item.qty || 0);
        }
      }

      // Determine what quantities are still left to be dispatched
      const remainingItems: any[] = [];
      for (const invItem of delivery.invoice.items) {
        const keyWithId = invItem.id;
        const keyFallback = `${invItem.productId}-${invItem.warehouseId || ''}-${invItem.batchNo || ''}`;
        const alreadyDispatched =
          dispatchedQtyByItem[keyWithId] ||
          0 ||
          dispatchedQtyByItem[keyFallback] ||
          0;
        const remainingQty = invItem.qty - alreadyDispatched;

        if (remainingQty > 0) {
          remainingItems.push({
            invoiceItemId: invItem.id,
            productId: invItem.productId,
            productName: invItem.product?.name || 'Product',
            unit: invItem.product?.unit || 'unit',
            warehouseId: invItem.warehouseId,
            warehouseName: invItem.warehouse?.name || 'Warehouse',
            warehouseAddress: invItem.warehouse?.address || '',
            batchNo: invItem.batchNo,
            qty: remainingQty,
            pickedUp: false,
          });
        }
      }

      // If there are remaining items left, ensure a pending delivery exists for the next driver
      if (remainingItems.length > 0) {
        const existingPending = await tx.delivery.findFirst({
          where: {
            invoiceId: delivery.invoiceId,
            status: DeliveryStatus.PENDING,
            id: { not: id },
          },
        });

        if (existingPending) {
          await tx.delivery.update({
            where: { id: existingPending.id },
            data: {
              items: remainingItems,
            },
          });
        } else {
          await tx.delivery.create({
            data: {
              invoiceId: delivery.invoiceId,
              status: DeliveryStatus.PENDING,
              driverId: null,
              items: remainingItems,
              notes: `Remaining balance items from Invoice #${delivery.invoice.invoiceNo}`,
            },
          });
        }
      }

      return {
        ...updatedDelivery,
        items: dispatchedItems,
      };
    });

    // Notify driver about newly assigned delivery
    void this.notifications.notifyUser(
      effectiveDriverId,
      'New Delivery Assigned!',
      `Invoice #${delivery.invoice?.invoiceNo} dispatched to you. Pick up items from warehouse.`,
      { type: 'DELIVERY_ASSIGNED', deliveryId: id },
    );

    return result;
  }

  async updateItemPickup(id: string, itemIndex: number, pickedUp: boolean) {
    const delivery = await this.findOne(id);
    const rawItems = Array.isArray(delivery.items) ? delivery.items : [];
    const itemsList: DeliveryItemPayload[] = [
      ...(rawItems as unknown as DeliveryItemPayload[]),
    ];

    if (itemIndex < 0 || itemIndex >= itemsList.length) {
      throw new BadRequestException('Invalid item index for pickup');
    }

    // Requirement: Once they have picked up the item they cannot mark it as not picked (option locked)
    if (itemsList[itemIndex].pickedUp && !pickedUp) {
      throw new BadRequestException(
        'This item has already been picked up and is locked. It cannot be marked as not picked.',
      );
    }

    const currentItem = itemsList[itemIndex];
    itemsList[itemIndex] = {
      ...currentItem,
      pickedUp: true,
      pickedUpAt: currentItem.pickedUpAt || new Date().toISOString(),
    };

    // Status remains OUT_FOR_PICKUP (or current status); driver must explicitly click Out for Delivery once all items are picked up
    const updated = await this.prisma.delivery.update({
      where: { id },
      data: {
        items: itemsList as unknown as Prisma.InputJsonValue,
      },
      include: {
        invoice: {
          include: {
            party: true,
            items: { include: { product: true, warehouse: true } },
          },
        },
        driver: { select: { id: true, name: true, phone: true } },
        trips: true,
      },
    });

    return {
      ...updated,
      items: itemsList,
    };
  }

  async collectCash(
    id: string,
    amount: number,
    notes?: string,
    actorId?: string,
  ) {
    const delivery = await this.findOne(id);

    const cashDecimal = new Prisma.Decimal((amount || 0).toFixed(2));

    // Update delivery record with collected cash in driver custody (not yet handed over to owner)
    const actorNote = actorId ? ` [Staff: ${actorId}]` : '';
    const updated = await this.prisma.delivery.update({
      where: { id },
      data: {
        status: DeliveryStatus.DELIVERED,
        cashCollected: cashDecimal,
        cashCollectedAt: new Date(),
        cashHandedOver: false,
        notes: notes
          ? delivery.notes
            ? `${delivery.notes} | ${notes}${actorNote}`
            : `${notes}${actorNote}`
          : delivery.notes,
      },
      include: {
        invoice: {
          include: {
            party: true,
            items: { include: { product: true, warehouse: true } },
          },
        },
        driver: { select: { id: true, name: true, phone: true } },
        trips: true,
      },
    });

    // Notify Owner & Admin about cash collection
    void this.notifications.notifyAdmins(
      'Delivery Cash Collected',
      `Driver ${delivery.driver?.name || 'Driver'} collected ₹${amount} for Invoice #${delivery.invoice?.invoiceNo}.`,
      { type: 'CASH_COLLECTED', deliveryId: id },
    );

    return {
      ...updated,
      items: Array.isArray(updated.items) ? updated.items : [],
    };
  }

  async handoverCash(id: string, actorId?: string, overrideAmount?: number) {
    const delivery = await this.findOne(id);

    // Determine actual cash received at office
    const effectiveCash =
      overrideAmount !== undefined
        ? Number(overrideAmount)
        : delivery.cashCollected !== null &&
            delivery.cashCollected !== undefined
          ? Number(delivery.cashCollected)
          : 0;

    const cashDecimal = new Prisma.Decimal(effectiveCash.toFixed(2));

    // Execute delivery update, payment creation, invoice status recalc, and credit ledger settlement atomically
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Mark delivery cashHandedOver = true (cleared from driver physical custody)
      const updated = await tx.delivery.update({
        where: { id },
        data: {
          cashHandedOver: true,
          cashHandedOverAt: new Date(),
          cashHandedOverToId: actorId || null,
          cashCollected: cashDecimal,
        },
        include: {
          invoice: {
            include: {
              party: true,
              items: { include: { product: true, warehouse: true } },
            },
          },
          driver: { select: { id: true, name: true, phone: true } },
          trips: true,
        },
      });

      // 2. If physical cash was received (> 0), record confirmed Payment in ERP transactions
      if (effectiveCash > 0) {
        await tx.payment.create({
          data: {
            invoiceId: delivery.invoiceId,
            partyId: delivery.invoice.partyId,
            mode: PaymentMode.CASH,
            type: PaymentType.INFLOW,
            amount: cashDecimal,
            status: PaymentStatus.CONFIRMED,
            confirmedById: actorId || undefined,
            paidAt: new Date(),
            notes: `Cash collected by driver ${delivery.driver?.name || ''} and handed over to office`,
          },
        });
      }

      // 3. Calculate all confirmed payments and invoice balance
      const invoice = await tx.invoice.findUnique({
        where: { id: delivery.invoiceId },
        include: { payments: true, party: true },
      });

      if (invoice) {
        const allConfirmedPayments = await tx.payment.findMany({
          where: {
            invoiceId: invoice.id,
            status: PaymentStatus.CONFIRMED,
          },
        });

        const totalPaid = allConfirmedPayments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        const invoiceTotal = Number(invoice.total);
        const remainingDue = Math.max(
          0,
          Math.round((invoiceTotal - totalPaid) * 100) / 100,
        );

        // Ensure the party is registered & saved permanently in the party directory
        if (invoice.party && !invoice.party.isSaved) {
          await tx.party.update({
            where: { id: invoice.party.id },
            data: { isSaved: true },
          });
        }

        // Check for existing credit ledger linked to this invoice
        const existingCredit = await tx.creditLedger.findFirst({
          where: { invoiceId: invoice.id },
        });

        if (remainingDue > 0) {
          // Invoice is partially paid; remaining amount is added to party credit
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: InvoiceStatus.PARTIAL },
          });

          if (existingCredit) {
            await tx.creditLedger.update({
              where: { id: existingCredit.id },
              data: {
                partyId: invoice.partyId,
                amountDue: new Prisma.Decimal(remainingDue.toFixed(2)),
                type: CreditType.RECEIVABLE,
                status: CreditStatus.PARTIAL,
              },
            });
          } else {
            await tx.creditLedger.create({
              data: {
                partyId: invoice.partyId,
                invoiceId: invoice.id,
                amountDue: new Prisma.Decimal(remainingDue.toFixed(2)),
                type: CreditType.RECEIVABLE,
                status: CreditStatus.PARTIAL,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days credit
                notes: `Pending balance from driver delivery on Invoice #${invoice.invoiceNo}`,
              },
            });
          }
        } else {
          // Invoice is 100% paid
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: InvoiceStatus.PAID },
          });

          if (existingCredit) {
            await tx.creditLedger.update({
              where: { id: existingCredit.id },
              data: {
                amountDue: new Prisma.Decimal(0),
                status: CreditStatus.SETTLED,
              },
            });
          }
        }
      }

      return {
        ...updated,
        items: Array.isArray(updated.items) ? updated.items : [],
      };
    });

    if (delivery.driverId) {
      void this.notifications.notifyUser(
        delivery.driverId,
        'Cash Handover Confirmed',
        `Admin verified ₹${effectiveCash} cash handover. Your physical custody is cleared.`,
        { type: 'CASH_HANDED_OVER', deliveryId: id },
      );
    }

    return result;
  }
}
