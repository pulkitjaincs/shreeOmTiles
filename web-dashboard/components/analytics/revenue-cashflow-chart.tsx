'use client';

import React, { useState, useMemo } from 'react';
import { TrendPoint } from './types';

interface RevenueCashflowChartProps {
  trendData: TrendPoint[];
}

export function RevenueCashflowChart({ trendData }: RevenueCashflowChartProps) {
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [activeChartSeries, setActiveChartSeries] = useState<'all' | 'invoiced' | 'collected'>('all');

  const chartHeight = 180;
  const chartWidth = 720;
  const paddingX = 40;
  const paddingY = 24;

  const maxTrendVal = useMemo(() => {
    if (!trendData.length) return 1000;
    const max = Math.max(
      ...trendData.map((d) => Math.max(d.invoiced, d.collected, d.credit)),
      1000
    );
    return Math.ceil(max * 1.15);
  }, [trendData]);

  const chartPoints = useMemo(() => {
    if (trendData.length === 0) return { invoicedPath: '', collectedPath: '', creditPath: '', points: [] };
    const stepX = (chartWidth - paddingX * 2) / Math.max(1, trendData.length - 1);

    const pts = trendData.map((d, i) => {
      const x = paddingX + i * stepX;
      const yInvoiced = chartHeight - paddingY - (d.invoiced / maxTrendVal) * (chartHeight - paddingY * 2);
      const yCollected = chartHeight - paddingY - (d.collected / maxTrendVal) * (chartHeight - paddingY * 2);
      const yCredit = chartHeight - paddingY - (d.credit / maxTrendVal) * (chartHeight - paddingY * 2);
      return { x, yInvoiced, yCollected, yCredit, data: d, index: i };
    });

    const createPath = (key: 'yInvoiced' | 'yCollected' | 'yCredit') => {
      return pts.reduce((acc, p, i) => {
        if (i === 0) return `M ${p.x} ${p[key]}`;
        const prev = pts[i - 1];
        const cpX = (prev.x + p.x) / 2;
        return `${acc} C ${cpX} ${prev[key]}, ${cpX} ${p[key]}, ${p.x} ${p[key]}`;
      }, '');
    };

    return {
      invoicedPath: createPath('yInvoiced'),
      collectedPath: createPath('yCollected'),
      creditPath: createPath('yCredit'),
      points: pts,
    };
  }, [trendData, maxTrendVal]);

  return (
    <div className="p-5 sm:p-6 rounded-3xl border border-border/80 bg-card/75 backdrop-blur-xl space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <h2 className="text-base font-bold text-foreground">Revenue & Cashflow Timeline</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily trend of Invoiced Sales, Confirmed Inflow Collections, and Credit extended.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveChartSeries('all')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
              activeChartSeries === 'all'
                ? 'bg-card text-foreground border border-border shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Series
          </button>
          <button
            onClick={() => setActiveChartSeries('invoiced')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 ${
              activeChartSeries === 'invoiced'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-primary hover:opacity-80'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-primary" />
            Invoiced
          </button>
          <button
            onClick={() => setActiveChartSeries('collected')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 ${
              activeChartSeries === 'collected'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-600 dark:text-emerald-400 hover:opacity-80'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Collected
          </button>
        </div>
      </div>

      {trendData.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-2xl">
          No transactions or invoices found for the selected date range.
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-48 select-none"
          >
            <defs>
              <linearGradient id="invoicedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Guide Lines */}
            <line
              x1={paddingX}
              y1={paddingY}
              x2={chartWidth - paddingX}
              y2={paddingY}
              stroke="currentColor"
              strokeDasharray="4 4"
              className="text-border"
              strokeWidth="1"
            />
            <line
              x1={paddingX}
              y1={chartHeight / 2}
              x2={chartWidth - paddingX}
              y2={chartHeight / 2}
              stroke="currentColor"
              strokeDasharray="4 4"
              className="text-border"
              strokeWidth="1"
            />
            <line
              x1={paddingX}
              y1={chartHeight - paddingY}
              x2={chartWidth - paddingX}
              y2={chartHeight - paddingY}
              stroke="currentColor"
              className="text-border"
              strokeWidth="1.5"
            />

            {/* Invoiced Area & Line */}
            {(activeChartSeries === 'all' || activeChartSeries === 'invoiced') && chartPoints.invoicedPath && (
              <>
                <path
                  d={`${chartPoints.invoicedPath} L ${chartWidth - paddingX} ${chartHeight - paddingY} L ${paddingX} ${chartHeight - paddingY} Z`}
                  fill="url(#invoicedGrad)"
                />
                <path
                  d={chartPoints.invoicedPath}
                  fill="none"
                  stroke="var(--color-primary, #6366f1)"
                  strokeWidth="2.5"
                />
              </>
            )}

            {/* Collections Area & Line */}
            {(activeChartSeries === 'all' || activeChartSeries === 'collected') && chartPoints.collectedPath && (
              <>
                <path
                  d={`${chartPoints.collectedPath} L ${chartWidth - paddingX} ${chartHeight - paddingY} L ${paddingX} ${chartHeight - paddingY} Z`}
                  fill="url(#collectedGrad)"
                />
                <path
                  d={chartPoints.collectedPath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                />
              </>
            )}

            {/* Credit Line */}
            {activeChartSeries === 'all' && chartPoints.creditPath && (
              <path
                d={chartPoints.creditPath}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="1.8"
                strokeDasharray="3 3"
              />
            )}

            {/* Interactive Points */}
            {chartPoints.points.map((p) => (
              <g
                key={p.data.date}
                onMouseEnter={() => setHoveredTrendIdx(p.index)}
                onMouseLeave={() => setHoveredTrendIdx(null)}
                className="cursor-pointer"
              >
                {/* Hover column trigger */}
                <rect
                  x={p.x - 12}
                  y={paddingY}
                  width={24}
                  height={chartHeight - paddingY * 2}
                  fill="transparent"
                />
                {hoveredTrendIdx === p.index && (
                  <line
                    x1={p.x}
                    y1={paddingY}
                    x2={p.x}
                    y2={chartHeight - paddingY}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}
                {(activeChartSeries === 'all' || activeChartSeries === 'invoiced') && (
                  <circle
                    cx={p.x}
                    cy={p.yInvoiced}
                    r={hoveredTrendIdx === p.index ? 5 : 3.5}
                    fill="var(--color-primary, #6366f1)"
                    stroke="var(--color-card, #ffffff)"
                    strokeWidth="1.5"
                  />
                )}
                {(activeChartSeries === 'all' || activeChartSeries === 'collected') && (
                  <circle
                    cx={p.x}
                    cy={p.yCollected}
                    r={hoveredTrendIdx === p.index ? 5 : 3.5}
                    fill="#10b981"
                    stroke="var(--color-card, #ffffff)"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            ))}
          </svg>

          {/* Interactive Hover Tooltip */}
          {hoveredTrendIdx !== null && chartPoints.points[hoveredTrendIdx] && (
            <div
              className="absolute pointer-events-none top-2 z-20 transform -translate-x-1/2 p-3 rounded-2xl bg-card border border-border shadow-xl backdrop-blur-xl text-xs space-y-1 min-w-[140px]"
              style={{
                left: `${(chartPoints.points[hoveredTrendIdx].x / chartWidth) * 100}%`,
              }}
            >
              <div className="font-bold text-foreground border-b border-border/80 pb-1">
                {chartPoints.points[hoveredTrendIdx].data.label}
              </div>
              <div className="flex justify-between items-center text-primary font-medium">
                <span>Invoiced:</span>
                <span className="font-mono font-bold">
                  ₹{Math.round(chartPoints.points[hoveredTrendIdx].data.invoiced).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Collected:</span>
                <span className="font-mono font-bold">
                  ₹{Math.round(chartPoints.points[hoveredTrendIdx].data.collected).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 font-medium">
                <span>Credit:</span>
                <span className="font-mono font-bold">
                  ₹{Math.round(chartPoints.points[hoveredTrendIdx].data.credit).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
