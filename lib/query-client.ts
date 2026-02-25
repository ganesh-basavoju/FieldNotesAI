import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";

import Constants from "expo-constants";
import { Platform } from "react-native";
import { AuthStorage } from "./storage";

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;
  if (host) {
    return new URL(`https://${host}`).href;
  }

  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (process.env.NODE_ENV === "development") {
    // In Expo Go, hostUri contains the IP of the development machine
    const hostUri = Constants?.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(":")[0];
      return `http://${ip}:5000`;
    }

    // Fallback for Android emulator
    if (Platform.OS === "android") {
      return "http://10.0.2.2:5000";
    }

    return "http://localhost:5000";
  }

  // Default to the deployed BigLogic backend for production/preview builds
  return "https://biglogicai-server.onrender.com";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  // Build headers with optional Bearer token for BigLogic auth
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";

  try {
    const savedAuth = await AuthStorage.get();
    if (savedAuth?.token) {
      headers["Authorization"] = `Bearer ${savedAuth.token}`;
    }
  } catch { }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      const baseUrl = getApiUrl();
      const url = new URL(queryKey.join("/") as string, baseUrl);

      const headers: Record<string, string> = {};
      try {
        const savedAuth = await AuthStorage.get();
        if (savedAuth?.token) {
          headers["Authorization"] = `Bearer ${savedAuth.token}`;
        }
      } catch { }

      const res = await fetch(url.toString(), {
        headers,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
