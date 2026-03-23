export const STALE_TIMES = {
  /**
   * Data that changes very frequently or needs to be real-time.
   * e.g. Pending transaction status, actively changing prices (if critical).
   * 15 seconds.
   */
  FAST: 15 * 1000,

  /**
   * Standard data that doesn't need to be instant but shouldn't be too stale.
   * e.g. Balances, Spot Prices, Availability.
   * 1 minute.
   */
  NORMAL: 60 * 1000,

  /**
   * Data that changes infrequently or is heavy to fetch.
   * e.g. Rewards Breakdown, Historical Charts, Leaderboards.
   * 5 minutes.
   */
  SLOW: 5 * 60 * 1000,

  /**
   * Data that effectively never changes for the session or is explicitly refreshed.
   * e.g. Static config, "Sticky" rewards data (until claimed).
   * 24 hours.
   */
  STATIC: 24 * 60 * 60 * 1000,
} as const;

export const QUERY_CONFIG = {
  /**
   * Default configuration for most queries.
   * - Refetch on window focus is disabled to prevent UI jumps/flicker.
   * - Stale time is NORMAL (1 min).
   */
  DEFAULT: {
    staleTime: STALE_TIMES.NORMAL,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },

  /**
   * Configuration for listing estimates that are relatively expensive and
   * should not churn during normal browsing.
   * These queries are explicitly invalidated when listing inputs change.
   */
  ESTIMATES: {
    staleTime: STALE_TIMES.SLOW,
    gcTime: STALE_TIMES.SLOW,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },

  /**
   * Configuration for "sticky" data that shouldn't refresh automatically to avoid UI jumps.
   * e.g. Claimable rewards during a session.
   */
  STICKY: {
    staleTime: STALE_TIMES.STATIC,
    gcTime: STALE_TIMES.STATIC,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },

  /**
   * Configuration for high-frequency data.
   */
  REALTIME: {
    staleTime: STALE_TIMES.FAST,
    refetchOnWindowFocus: true,
    refetchInterval: STALE_TIMES.FAST,
  },
} as const;
