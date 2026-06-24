import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePolling } from "./polling";

describe("usePolling Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should poll immediately and repeat at intervals", async () => {
    const fetchFn = vi.fn().mockResolvedValue("data");
    const stopCondition = vi.fn().mockReturnValue(false);

    const { result } = renderHook(() => usePolling(fetchFn, 1000, stopCondition));

    // Wait for the immediate call
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe("data");
    expect(result.current.isStale).toBe(false);

    // Fast-forward 1 second
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("should set isStale to true and continue on failure", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce("data-1")
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce("data-2");

    const stopCondition = vi.fn().mockReturnValue(false);

    const { result } = renderHook(() => usePolling(fetchFn, 1000, stopCondition));

    // Immediate call succeeds
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.data).toBe("data-1");
    expect(result.current.isStale).toBe(false);

    // Second poll fails
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(result.current.isStale).toBe(true);
    expect(result.current.error?.message).toBe("Network Error");

    // Third poll succeeds
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(result.current.isStale).toBe(false);
    expect(result.current.data).toBe("data-2");
  });

  it("should stop polling when stopCondition is met", async () => {
    const fetchFn = vi.fn().mockResolvedValue("stop-now");
    const stopCondition = vi.fn().mockImplementation((d) => d === "stop-now");

    renderHook(() => usePolling(fetchFn, 1000, stopCondition));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Try to advance timers, should not run again since it's stopped
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
