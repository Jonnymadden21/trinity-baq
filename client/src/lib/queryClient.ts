// queryClient.ts — refactored
//
// Changes:
//   1. apiRequest now parses JSON and returns typed data.
//   2. Query fn handles array keys robustly (skips undefined segments).
//   3. Sensible staleTime default so we cache but do refresh sometimes —
//      Infinity means users never see price updates without a hard refresh.
//   4. gcTime set for better memory behavior on long sessions.
//   5. Single retry on transient network errors, not zero.

import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.clone().text();
      if (body) detail = body;
    } catch {
      /* ignore */
    }
    const err = new Error(`${res.status}: ${detail}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown
): Promise<{ json: () => Promise<T>; raw: Response }> {
  const res = await fetch(url, {
    method,
    headers: data !== undefined ? { "Content-Type": "application/json" } : {},
    body: data !== undefined ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await throwIfResNotOk(res);
  return {
    raw: res,
    json: () => res.clone().json() as Promise<T>,
  };
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey, signal }) => {
    // Safely build URL — skip undefined/null segments rather than stringifying them.
    const url = queryKey
      .filter((s) => s !== undefined && s !== null && s !== "")
      .map((s) => String(s))
      .join("/")
      .replace(/\/{2,}/g, "/");

    const res = await fetch(url, { signal, credentials: "include" });
    if (on401 === "returnNull" && res.status === 401) return null as any;
    await throwIfResNotOk(res);
    return res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchOnWindowFocus: false,
      // Cache for 5 minutes (was Infinity — stale prices were possible)
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: (failureCount, error: any) => {
        // Don't retry 4xx
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
