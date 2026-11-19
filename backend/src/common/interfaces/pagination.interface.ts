export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DateRangeFilter {
  from?: string; // ISO date string YYYY-MM-DD
  to?: string; // ISO date string YYYY-MM-DD
  preset?: 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL';
}

export function buildDateRange(
  filter?: DateRangeFilter,
): { gte?: Date; lte?: Date } | undefined {
  if (
    !filter ||
    filter.preset === 'ALL' ||
    (!filter.preset && !filter.from && !filter.to)
  )
    return undefined;
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (filter.from || filter.to) {
    return {
      gte: filter.from ? startOfDay(new Date(filter.from)) : undefined,
      lte: filter.to ? endOfDay(new Date(filter.to)) : undefined,
    };
  }

  switch (filter.preset) {
    case 'TODAY':
      return { gte: startOfDay(now), lte: endOfDay(now) };
    case 'YESTERDAY': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { gte: startOfDay(y), lte: endOfDay(y) };
    }
    case 'THIS_WEEK': {
      const startW = new Date(now);
      startW.setDate(startW.getDate() - ((startW.getDay() + 6) % 7));
      const endW = new Date(startW);
      endW.setDate(endW.getDate() + 6);
      return { gte: startOfDay(startW), lte: endOfDay(endW) };
    }
    case 'THIS_MONTH': {
      const startM = new Date(now.getFullYear(), now.getMonth(), 1);
      const endM = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { gte: startM, lte: endOfDay(endM) };
    }
    default:
      return undefined;
  }
}
