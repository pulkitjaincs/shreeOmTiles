import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
  Role,
} from '@prisma/client';
import {
  PaginationParams,
  DateRangeFilter,
  buildDateRange,
} from '../common/interfaces/pagination.interface';

import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import {
  generateDeliveryChallanPdf,
  DeliveryChallanPayload,
} from './pdf/delivery-challan-pdf.generator';

interface DeliveryItemPayload {
  invoiceItemId?: string | null;
  productId?: string | null;
  productName?: string | null;
  unit?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  warehouseAddress?: string | null;
  batchNo?: string | null;
  qty?: number | null;
  pickedUp?: boolean | null;
  pickedUpAt?: string | null;
  pickedUpByName?: string | null;
  pickedUpById?: string | null;
}

export type DeliveryDetailResult = Prisma.DeliveryGetPayload<{
  include: {
    supervisors: {
      include: {
        supervisor: {
          select: { id: true; name: true; phone: true; role: true };
        };
      };
    };
    invoice: {
      include: {
        party: true;
        items: { include: { product: true; warehouse: true } };
      };
    };
    driver: { select: { id: true; name: true; phone: true } };
    trips: true;
  };
}> & {
  items: DeliveryItemPayload[];
};

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly paymentsService: PaymentsService,
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
    pagination?: PaginationParams & {
      dateFilter?: DateRangeFilter;
      search?: string;
    },
    requestingUser?: { id: string; role: Role; scope?: string | null },
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

    // Supervisor rule: only view deliveries to which this supervisor is assigned
    const isSupervisor = requestingUser?.role === Role.SUPERVISOR;
    if (isSupervisor && requestingUser?.id) {
      where.supervisors = {
        some: { supervisorId: requestingUser.id },
      };
    }

    const dateRange = buildDateRange(pagination?.dateFilter);
    if (dateRange) {
      where.createdAt = dateRange;
    }

    const includeRelations = {
      supervisors: {
        include: {
          supervisor: {
            select: {
              id: true,
              name: true,
              phone: true,
              role: true,
            },
          },
        },
      },
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

    const sanitizeForSupervisor = <T extends Record<string, unknown>>(
      d: T,
    ): T => {
      const rawTrips = Array.isArray(d.trips)
        ? (d.trips as Array<Record<string, unknown>>)
        : [];
      const trips = rawTrips.map((t) => ({
        ...t,
        cost: new Prisma.Decimal(0),
      }));

      const rawInvoice =
        d.invoice && typeof d.invoice === 'object'
          ? (d.invoice as Record<string, unknown>)
          : null;
      let invoice = rawInvoice;
      if (rawInvoice) {
        const rawItems = Array.isArray(rawInvoice.items)
          ? (rawInvoice.items as Array<Record<string, unknown>>)
          : [];
        const items = rawItems.map((it) => ({
          ...it,
          unitPrice: new Prisma.Decimal(0),
          discount: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
        }));
        invoice = {
          ...rawInvoice,
          subtotal: new Prisma.Decimal(0),
          tax: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
          transportCost: new Prisma.Decimal(0),
          transportTax: new Prisma.Decimal(0),
          itemsTax: new Prisma.Decimal(0),
          taxBreakup: {},
          items,
        };
      }

      return {
        ...d,
        amountToCollect: new Prisma.Decimal(0),
        cashCollected: new Prisma.Decimal(0),
        trips,
        invoice,
      };
    };

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
        const normalized = {
          ...d,
          items: parsedItems,
        };
        return isSupervisor ? sanitizeForSupervisor(normalized) : normalized;
      });

    if (pagination?.page !== undefined || pagination?.limit !== undefined) {
      const page = Math.max(1, pagination?.page || 1);
      const limit = Math.min(Math.max(1, pagination?.limit || 40), 500);
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
      ...(dateRange || pagination?.search ? {} : { take: 2000 }),
    });

    // Normalize items: if delivery has specific items saved, use those; else fallback to invoice items
    return normalizeItems(deliveries);
  }

  async findOne(
    id: string,
    requestingUser?: { id: string; role: Role; scope?: string | null },
  ): Promise<DeliveryDetailResult> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: {
        supervisors: {
          include: {
            supervisor: {
              select: { id: true, name: true, phone: true, role: true },
            },
          },
        },
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

    const rawDeliveryItems = Array.isArray(delivery.items)
      ? (delivery.items as DeliveryItemPayload[])
      : [];

    const parsedItems: DeliveryItemPayload[] =
      rawDeliveryItems.length > 0
        ? rawDeliveryItems
        : delivery.invoice.items.map((it) => ({
            invoiceItemId: it.id,
            productId: it.productId,
            productName: it.product?.name || 'Product',
            unit: it.product?.unit || 'unit',
            warehouseId: it.warehouseId,
            warehouseName: it.warehouse?.name || 'Warehouse',
            warehouseAddress: it.warehouse?.address || '',
            batchNo: it.batchNo,
            qty: Number(it.qty),
            pickedUp: false,
          }));

    const result = {
      ...delivery,
      items: parsedItems,
    };

    if (requestingUser?.role === Role.SUPERVISOR) {
      return {
        ...result,
        amountToCollect: new Prisma.Decimal(0),
        cashCollected: new Prisma.Decimal(0),
        trips: (result.trips || []).map((t) => ({
          ...t,
          cost: new Prisma.Decimal(0),
        })),
        invoice: result.invoice
          ? {
              ...result.invoice,
              subtotal: new Prisma.Decimal(0),
              tax: new Prisma.Decimal(0),
              total: new Prisma.Decimal(0),
              transportCost: new Prisma.Decimal(0),
              transportTax: new Prisma.Decimal(0),
              itemsTax: new Prisma.Decimal(0),
              taxBreakup: {},
              items: (result.invoice.items || []).map((it) => ({
                ...it,
                unitPrice: new Prisma.Decimal(0),
                discount: new Prisma.Decimal(0),
                total: new Prisma.Decimal(0),
              })),
            }
          : result.invoice,
      } as unknown as DeliveryDetailResult;
    }

    return result as DeliveryDetailResult;
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

  async updateStatus(
    id: string,
    status: DeliveryStatus,
    notes?: string,
    actor?: { id: string; role: Role; name?: string },
  ) {
    const delivery = await this.findOne(id);

    // Driver ownership verification
    if (actor?.role === Role.DRIVER && delivery.driverId !== actor.id) {
      throw new ForbiddenException(
        'You can only update deliveries assigned to you.',
      );
    }

    // Cancellation is disabled
    if (status === DeliveryStatus.CANCELLED) {
      throw new BadRequestException(
        'Deliveries cannot be cancelled. Edit delivery or invoice instead.',
      );
    }

    // Terminal state protection
    if (delivery.status === DeliveryStatus.DELIVERED) {
      throw new BadRequestException(
        'Delivered orders are locked and cannot be modified.',
      );
    }

    // State machine transition validation
    if (delivery.status === DeliveryStatus.PENDING) {
      if (
        status !== DeliveryStatus.ASSIGNED &&
        status !== DeliveryStatus.DELIVERED
      ) {
        throw new BadRequestException(
          'Pending delivery must be assigned before dispatch.',
        );
      }
    } else if (delivery.status === DeliveryStatus.ASSIGNED) {
      if (
        status !== DeliveryStatus.OUT_FOR_PICKUP &&
        status !== DeliveryStatus.DELIVERED
      ) {
        throw new BadRequestException(
          'Assigned delivery must move to Out For Pickup first.',
        );
      }
    } else if (delivery.status === DeliveryStatus.OUT_FOR_PICKUP) {
      if (
        status !== DeliveryStatus.OUT_FOR_DELIVERY &&
        status !== DeliveryStatus.DELIVERED
      ) {
        throw new BadRequestException(
          'Out For Pickup delivery must move to Out For Delivery or Delivered.',
        );
      }
    } else if (delivery.status === DeliveryStatus.OUT_FOR_DELIVERY) {
      if (status !== DeliveryStatus.DELIVERED) {
        throw new BadRequestException(
          'Out For Delivery can only transition to Delivered.',
        );
      }
    }

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
    let updatedItems: DeliveryItemPayload[] =
      Array.isArray(delivery.items) && delivery.items.length > 0
        ? delivery.items
        : [];
    if (isMarkingCustomerPickup) {
      if (updatedItems.length === 0 && delivery.invoice?.items) {
        updatedItems = delivery.invoice.items.map((it) => ({
          productId: it.productId,
          productName: it.product?.name || 'Product',
          qty: Number(it.qty),
          pickedUp: true,
          pickedUpAt: new Date().toISOString(),
        }));
      } else {
        updatedItems = updatedItems.map((it) => ({
          ...it,
          pickedUp: true,
          pickedUpAt: it.pickedUpAt || new Date().toISOString(),
        }));
      }
    }

    const updated = await this.prisma.delivery.update({
      where: { id },
      data: {
        status,
        ...(isMarkingCustomerPickup
          ? {
              driverId: null,
              items: updatedItems as unknown as Prisma.InputJsonValue,
            }
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
        {
          type: 'DELIVERY_COMPLETED',
          deliveryId: id,
          invoiceId: updated.invoiceId,
        },
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
      (delivery.status === DeliveryStatus.DELIVERED && !dto.isCustomerPickup)
    ) {
      throw new BadRequestException(
        'Order was already delivered or customer pickup completed.',
      );
    }

    if (
      delivery.status !== DeliveryStatus.PENDING &&
      delivery.status !== DeliveryStatus.ASSIGNED
    ) {
      throw new BadRequestException(
        'Delivery has already progressed beyond dispatch editing.',
      );
    }

    const isCustomerPickup = Boolean(dto.isCustomerPickup);
    let effectiveDriverId: string | null = null;

    if (!isCustomerPickup) {
      effectiveDriverId = dto.driverId || delivery.driverId || null;
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
    }

    // 1. Determine dispatched items for this delivery
    const defaultItems = delivery.invoice.items.map((it) => ({
      invoiceItemId: it.id,
      productId: it.productId,
      productName: it.product?.name || 'Product',
      unit: it.product?.unit || 'unit',
      qty: it.qty,
      pickedUp: isCustomerPickup,
      pickedUpAt: isCustomerPickup ? new Date().toISOString() : undefined,
    }));

    const dispatchedItems =
      dto.items && dto.items.length > 0
        ? dto.items.map((it) => ({
            ...it,
            pickedUp: isCustomerPickup,
            pickedUpAt: isCustomerPickup ? new Date().toISOString() : undefined,
          }))
        : defaultItems;

    // 2. Execute all dispatch modifications atomically inside a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // If vehicle is specified and not customer pickup, record vehicle trip info
      if (!isCustomerPickup && (dto.vehicle || dto.vehicleNo)) {
        await tx.deliveryTrip.create({
          data: {
            deliveryId: id,
            tripNo: delivery.trips.length + 1,
            vehicle: dto.vehicle || dto.vehicleNo || undefined,
            cost: new Prisma.Decimal(0),
            notes: dto.notes || 'Dispatch vehicle recorded on push',
          },
        });
      }

      // If supervisors are provided, sync DeliverySupervisor records (for driver delivery & customer pickup)
      if (dto.supervisorIds !== undefined) {
        await tx.deliverySupervisor.deleteMany({
          where: { deliveryId: id },
        });
        if (dto.supervisorIds.length > 0) {
          await tx.deliverySupervisor.createMany({
            data: dto.supervisorIds.map((sId) => ({
              deliveryId: id,
              supervisorId: sId,
            })),
          });
        }
      }

      const newStatus = isCustomerPickup
        ? DeliveryStatus.DELIVERED
        : DeliveryStatus.ASSIGNED;
      const finalNotes = isCustomerPickup
        ? dto.notes
          ? `Customer Picked Up: ${dto.notes}`
          : 'Customer Picked Up (Self/Counter Pickup)'
        : dto.notes !== undefined
          ? dto.notes
          : delivery.notes;

      // Transition this delivery status with amountToCollect and dispatched items
      const updatedDelivery = await tx.delivery.update({
        where: { id },
        data: {
          status: newStatus,
          driverId: effectiveDriverId,
          notes: finalNotes,
          items: dispatchedItems,
          amountToCollect:
            dto.amountToCollect !== undefined
              ? new Prisma.Decimal((dto.amountToCollect || 0).toFixed(2))
              : delivery.amountToCollect,
        },
        include: {
          supervisors: {
            include: {
              supervisor: {
                select: { id: true, name: true, phone: true, role: true },
              },
            },
          },
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
          const key = item.invoiceItemId || item.productId || '';
          dispatchedQtyByItem[key] =
            (dispatchedQtyByItem[key] || 0) + Number(item.qty || 0);
        }
      }

      const remainingItems: DeliveryItemPayload[] = [];
      for (const invItem of delivery.invoice.items) {
        const keyWithId = invItem.id;
        const keyFallback = invItem.productId;
        const alreadyDispatched =
          dispatchedQtyByItem[keyWithId] ??
          (keyFallback ? dispatchedQtyByItem[keyFallback] : undefined) ??
          0;
        const remainingQty = Number(invItem.qty) - alreadyDispatched;

        if (remainingQty > 0) {
          remainingItems.push({
            invoiceItemId: invItem.id,
            productId: invItem.productId,
            productName: invItem.product?.name || 'Product',
            unit: invItem.product?.unit || 'unit',
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
              items: remainingItems as unknown as Prisma.InputJsonValue,
            },
          });
        } else {
          const remainingAmount = Math.max(
            0,
            Number(delivery.amountToCollect || 0) - (dto.amountToCollect || 0),
          );
          await tx.delivery.create({
            data: {
              invoiceId: delivery.invoiceId,
              status: DeliveryStatus.PENDING,
              driverId: null,
              amountToCollect: new Prisma.Decimal(remainingAmount.toFixed(2)),
              items: remainingItems as unknown as Prisma.InputJsonValue,
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
    if (effectiveDriverId) {
      void this.notifications.notifyUser(
        effectiveDriverId,
        'New Delivery Assigned!',
        `Invoice #${delivery.invoice?.invoiceNo} dispatched to you. Pick up items from warehouse.`,
        { type: 'DELIVERY_ASSIGNED', deliveryId: id },
      );
    }

    // Notify assigned supervisors
    if (dto.supervisorIds && dto.supervisorIds.length > 0) {
      for (const supId of dto.supervisorIds) {
        void this.notifications.notifyUser(
          supId,
          'Delivery Assigned for Supervision',
          `You have been assigned to oversee item dispatch for Invoice #${delivery.invoice?.invoiceNo}.`,
          { type: 'DELIVERY_SUPERVISOR_ASSIGNED', deliveryId: id },
        );
      }
    }

    return result;
  }

  async updateItemPickup(
    id: string,
    itemIndex: number,
    pickedUp: boolean,
    actor?: { id: string; role: Role; name?: string; scope?: string | null },
  ) {
    if (actor?.role === Role.DRIVER) {
      throw new ForbiddenException(
        'Drivers are not permitted to mark items as picked. The warehouse supervisor must confirm pickup.',
      );
    }

    const delivery = await this.findOne(id);
    const rawItems = Array.isArray(delivery.items) ? delivery.items : [];
    const itemsList: DeliveryItemPayload[] = [...rawItems];

    if (itemIndex < 0 || itemIndex >= itemsList.length) {
      throw new BadRequestException('Invalid item index for pickup');
    }

    // If supervisor, check that they are assigned to this delivery
    if (actor?.role === Role.SUPERVISOR) {
      const supervisors =
        (
          delivery as unknown as {
            supervisors?: Array<{ supervisorId: string }>;
          }
        ).supervisors || [];
      if (supervisors.length > 0) {
        const isAssigned = supervisors.some((s) => s.supervisorId === actor.id);
        if (!isAssigned) {
          throw new ForbiddenException(
            'You are not assigned as a supervisor for this delivery.',
          );
        }
      }
    }

    const currentItem = itemsList[itemIndex];

    // Requirement: Once they have picked up the item they cannot mark it as not picked (option locked)
    if (currentItem.pickedUp && !pickedUp) {
      throw new BadRequestException(
        'This item has already been picked up and is locked. It cannot be marked as not picked.',
      );
    }

    itemsList[itemIndex] = {
      ...currentItem,
      pickedUp: true,
      pickedUpAt: currentItem.pickedUpAt || new Date().toISOString(),
      pickedUpByName: actor?.name || 'Supervisor',
      pickedUpById: actor?.id,
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

    if (delivery.cashHandedOver) {
      throw new BadRequestException(
        'Cash for this delivery has already been handed over and confirmed.',
      );
    }

    // Determine actual cash received at office
    const collectedNum =
      delivery.cashCollected !== null && delivery.cashCollected !== undefined
        ? Number(delivery.cashCollected)
        : 0;

    const effectiveCash =
      overrideAmount !== undefined ? Number(overrideAmount) : collectedNum;

    const cashDecimal = new Prisma.Decimal(effectiveCash.toFixed(2));

    let shortfallNote = '';
    if (overrideAmount !== undefined && collectedNum > effectiveCash) {
      const shortfall = collectedNum - effectiveCash;
      shortfallNote = ` | [Shortfall: Driver collected ₹${collectedNum.toFixed(2)}, office received ₹${effectiveCash.toFixed(2)}. Shortfall ₹${shortfall.toFixed(2)} recorded by staff ${actorId || 'Office'}]`;
      void this.notifications.notifyAdmins(
        'Cash Handover Shortfall',
        `Cash shortfall of ₹${shortfall.toFixed(2)} recorded on Invoice #${delivery.invoice?.invoiceNo} (Driver: ${delivery.driver?.name || 'Driver'}).`,
        { type: 'CASH_SHORTFALL', deliveryId: id },
      );
    }

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
          notes: shortfallNote
            ? delivery.notes
              ? `${delivery.notes}${shortfallNote}`
              : shortfallNote.replace(/^\s*\|\s*/, '')
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
            notes: shortfallNote
              ? `Cash collected by driver ${delivery.driver?.name || ''} and handed over to office (Shortfall ₹${(collectedNum - effectiveCash).toFixed(2)} noted)`
              : `Cash collected by driver ${delivery.driver?.name || ''} and handed over to office`,
          },
        });
      }

      // 3. Calculate all confirmed payments and invoice balance
      const invoice = await tx.invoice.findUnique({
        where: { id: delivery.invoiceId },
        include: { payments: true, party: true, refundInvoices: true },
      });

      if (invoice) {
        const allConfirmedPayments = await tx.payment.findMany({
          where: {
            invoiceId: invoice.id,
            status: PaymentStatus.CONFIRMED,
          },
        });

        const totalPaid = allConfirmedPayments.reduce(
          (sum, p) =>
            p.type === PaymentType.OUTFLOW
              ? sum - Number(p.amount)
              : sum + Number(p.amount),
          0,
        );
        const totalReturns = (invoice.refundInvoices || []).reduce(
          (sum, r) => sum + Number(r.total || 0),
          0,
        );
        const netInvoiceTotal = Math.max(
          0,
          Number(invoice.total) - totalReturns,
        );
        const remainingDue = Math.max(
          0,
          Math.round((netInvoiceTotal - totalPaid) * 100) / 100,
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
            data: {
              status: InvoiceStatus.PARTIAL,
            },
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
          // Invoice is 100% paid or cancelled via return
          const isFullyRefunded =
            Number(invoice.total) > 0 &&
            totalReturns >= Number(invoice.total) - 0.01;
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: isFullyRefunded
                ? InvoiceStatus.CANCELLED
                : InvoiceStatus.PAID,
            },
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

        await this.paymentsService.reconcilePartyFinancials(
          invoice.partyId,
          tx,
        );
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

  async generateChallanPdf(id: string) {
    const delivery = await this.findOne(id);
    return generateDeliveryChallanPdf(
      delivery as unknown as DeliveryChallanPayload,
    );
  }
}
