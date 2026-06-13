import { useEffect, useState, useRef } from "react";

/**
 * Custom React hook for polling API endpoints at fixed intervals.
 * 
 * Enforces resilient behavior:
 * - If a poll fails, sets `isStale` to true, but does NOT stop the polling loop (Requirement 15.4).
 * - Stops loop when `stopCondition` evaluates to true.
 * - Safely handles dependency updates.
 */
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs: number,
  stopCondition: (data: T) => boolean
) {
  const [data, setData] = useState<T | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRef = useRef(fetchFn);
  const stopRef = useRef(stopCondition);
  const intervalIdRef = useRef<number | null>(null);

  // Keep references updated to prevent stale closures
  useEffect(() => {
    fetchRef.current = fetchFn;
    stopRef.current = stopCondition;
  }, [fetchFn, stopCondition]);

  const stop = () => {
    if (intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  };

  useEffect(() => {
    let active = true;

    async function tick() {
      try {
        const response = await fetchRef.current();
        if (!active) return;

        setData(response);
        setIsStale(false);
        setError(null);

        // Check if we should stop
        if (stopRef.current(response)) {
          stop();
        }
      } catch (err) {
        if (!active) return;
        
        // Log the polling failure
        console.warn("Polling error encountered, serving stale data:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsStale(true); // Flag data as stale, but do NOT clear the interval loop (Requirement 15.4)
      }
    }

    // Run first call immediately
    tick();

    // Setup recurring interval (use window.setInterval for browser compatibility in dev)
    intervalIdRef.current = window.setInterval(tick, intervalMs);

    return () => {
      active = false;
      stop();
    };
  }, [intervalMs]);

  return { data, isStale, error, stop };
}
