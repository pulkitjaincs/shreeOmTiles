'use client';

import { useEffect, useState, useRef } from 'react';

// Custom event identifiers for decoupled global triggering
const EVENT_START = 'app:reload:start';
const EVENT_STOP = 'app:reload:stop';

let activeRequestsCount = 0;
let hardSafetyTimer: NodeJS.Timeout | null = null;

/**
 * Triggers the top reload progress bar to start.
 * Safe to call from anywhere in client code.
 */
export function startTopReload(): void {
  if (typeof window === 'undefined') return;
  activeRequestsCount++;
  window.dispatchEvent(new CustomEvent(EVENT_START));

  // Hard safety timeout: Ensures the bar can NEVER get stuck on screen
  if (hardSafetyTimer) clearTimeout(hardSafetyTimer);
  hardSafetyTimer = setTimeout(() => {
    activeRequestsCount = 0;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_STOP));
    }
  }, 3500);
}

/**
 * Signals that a reload request has completed.
 * When all active requests finish, the top bar smoothly dashes to 100% and fades out.
 */
export function stopTopReload(): void {
  if (typeof window === 'undefined') return;
  activeRequestsCount = Math.max(0, activeRequestsCount - 1);
  if (activeRequestsCount === 0) {
    if (hardSafetyTimer) {
      clearTimeout(hardSafetyTimer);
      hardSafetyTimer = null;
    }
    window.dispatchEvent(new CustomEvent(EVENT_STOP));
  }
}

/**
 * Immediately forces the reload bar to complete and disappear.
 */
export function resetTopReload(): void {
  if (typeof window === 'undefined') return;
  activeRequestsCount = 0;
  if (hardSafetyTimer) {
    clearTimeout(hardSafetyTimer);
    hardSafetyTimer = null;
  }
  window.dispatchEvent(new CustomEvent(EVENT_STOP));
}

/**
 * Helper to wrap an async operation with the top reload bar.
 */
export async function triggerTopReload<T>(fn?: () => Promise<T>): Promise<T | void> {
  startTopReload();
  try {
    if (fn) {
      return await fn();
    }
  } finally {
    stopTopReload();
  }
}

export function TopReloadBar() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fade, setFade] = useState(false);

  const trickleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleStart = () => {
      // Clear pending finish/cleanup timers
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      if (trickleTimerRef.current) clearInterval(trickleTimerRef.current);

      startTimeRef.current = Date.now();
      setFade(false);
      setVisible(true);
      setProgress((prev) => (prev > 0 && prev < 85 ? prev : 20));

      // Trickle progress up to ~85% while waiting
      trickleTimerRef.current = setInterval(() => {
        setProgress((curr) => {
          if (curr >= 85) return curr;
          const remaining = 85 - curr;
          const step = Math.max(2, Math.floor(remaining * 0.2));
          return Math.min(85, curr + step);
        });
      }, 180);
    };

    const handleStop = () => {
      if (trickleTimerRef.current) {
        clearInterval(trickleTimerRef.current);
        trickleTimerRef.current = null;
      }

      const elapsed = Date.now() - startTimeRef.current;
      // Ensure the bar is visible for at least 400ms so user gets clear visual confirmation
      const minDisplayDuration = 400;
      const delay = Math.max(0, minDisplayDuration - elapsed);

      finishTimerRef.current = setTimeout(() => {
        setProgress(100);

        // Fade out after hitting 100%
        cleanupTimerRef.current = setTimeout(() => {
          setFade(true);

          // Reset state after fade transition finishes
          setTimeout(() => {
            setVisible(false);
            setProgress(0);
            setFade(false);
          }, 300);
        }, 220);
      }, delay);
    };

    window.addEventListener(EVENT_START, handleStart);
    window.addEventListener(EVENT_STOP, handleStop);

    return () => {
      window.removeEventListener(EVENT_START, handleStart);
      window.removeEventListener(EVENT_STOP, handleStop);
      if (trickleTimerRef.current) clearInterval(trickleTimerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Refreshing dashboard data"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      className="fixed top-0 inset-x-0 z-[999999] pointer-events-none select-none transition-opacity duration-300 ease-out"
      style={{ opacity: fade ? 0 : 1 }}
    >
      {/* 3.5px Height Track */}
      <div className="h-[3.5px] w-full bg-blue-950/20 dark:bg-blue-900/30 overflow-hidden relative backdrop-blur-xs">
        {/* Animated Blue Gradient Progress Bar */}
        <div
          className="h-full bg-gradient-to-r from-blue-600 via-sky-400 to-blue-500 shadow-[0_0_14px_rgba(37,99,235,0.95),0_0_6px_rgba(56,189,248,1)] relative"
          style={{
            width: `${progress}%`,
            transition:
              progress === 100
                ? 'width 200ms cubic-bezier(0.1, 0.9, 0.2, 1)'
                : 'width 250ms ease-out',
          }}
        >
          {/* Glowing Head / Leading Edge */}
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-white/50 to-white blur-[0.5px]" />
        </div>
      </div>
    </div>
  );
}
