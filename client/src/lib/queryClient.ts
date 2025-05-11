import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export interface ApiRequestOptions {
  method?: string;
  data?: unknown;
  headers?: Record<string, string>;
}

/**
 * Unified API request function for all HTTP methods
 * 
 * @param url API endpoint URL
 * @param options Request options (method, data, headers)
 * @returns JSON response data
 */
export async function apiRequest(
  url: string,
  options?: ApiRequestOptions
): Promise<any> {
  const method = options?.method || 'GET';
  const data = options?.data;
  const customHeaders = options?.headers || {};
  
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...customHeaders
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // For no-content responses
  if (res.status === 204) {
    return null;
  }
  
  // Parse JSON response
  try {
    return await res.json();
  } catch (e) {
    console.error('Error parsing JSON response:', e);
    return null;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Handle array-style query keys by joining them to form a proper URL path
    let url: string;
    
    if (Array.isArray(queryKey) && queryKey.length > 1) {
      // Filter out null/undefined values
      const validSegments = queryKey.filter(segment => segment !== null && segment !== undefined);
      
      // If the first segment already starts with a slash, use it as the base
      if (typeof validSegments[0] === 'string' && validSegments[0].startsWith('/')) {
        // Join all segments with slashes, ensuring proper URL format
        url = validSegments.reduce((path, segment, index) => {
          if (index === 0) return segment as string;
          return `${path}/${segment}`;
        }, '');
      } else {
        // Simple join if not starting with slash
        url = validSegments.join('/');
      }
    } else {
      // Default to the first element if it's not an array format
      url = queryKey[0] as string;
    }
    
    console.log(`Fetching from URL: ${url}`);
    
    const res = await fetch(url, {
      credentials: "include",
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
