type RequestReturns = "text" | "json" | "arraybuffer";

export type RequestOptions = RequestInit & {
  next?: {
    revalidate?: number;
  };
  searchParams?: Record<string, unknown>;
  throwOnError?: boolean;
  returns?: RequestReturns;
};

const DEBUG = false;
const DEFAULT_OPTIONS: RequestOptions = {
  throwOnError: false,
  returns: "json",
};

class Request {
  private static pendingRequests = new Map<string, Promise<unknown>>();

  private static getCacheKey(
    url: string,
    method: string,
    options?: RequestOptions
  ): string {
    return JSON.stringify({ url, method, options });
  }

  private static buildUrl(
    baseUrl: string,
    searchParams?: Record<string, unknown>
  ): string {
    if (!searchParams) return baseUrl;

    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      params.append(key, String(value));
    });
    return `${baseUrl}?${params.toString()}`;
  }

  private static async executeRequest<T>(
    url: string,
    method: "GET" | "POST",
    options: RequestOptions
  ): Promise<T | undefined> {
    try {
      const response = await fetch(url, {
        method,
        ...options,
      });

      this.checkRateLimit(url, response);

      if (!response.ok) {
        if (options.throwOnError) {
          throw new Error(`Failed to request ${url}`, { cause: response });
        }
        return undefined;
      }

      switch (options.returns) {
        case "text":
          return (await response.text()) as T;
        case "arraybuffer":
          return (await response.arrayBuffer()) as T;
        case "json":
        default:
          return (await response.json()) as T;
      }
    } catch (error) {
      if (error instanceof Error) {
        if (options.throwOnError) {
          throw error;
        }
        return undefined;
      }
      throw error;
    }
  }

  private static checkRateLimit(url: string, response: Response): void {
    const rateLimit = response.headers.get("x-ratelimit-remaining");
    if (rateLimit) {
      const remaining = Number(rateLimit);
      if (remaining < 100) {
        console.warn(`Rate limit for ${url} remaining: ${remaining}`);
      }
    }
  }

  static async send<T>(
    url: string,
    method: "GET" | "POST",
    options?: RequestOptions
  ): Promise<T | undefined> {
    const finalOptions = { ...DEFAULT_OPTIONS, ...options };
    const finalUrl = this.buildUrl(url, finalOptions.searchParams);
    const cacheKey = this.getCacheKey(finalUrl, method, finalOptions);

    if (DEBUG) {
      console.info(`Sending request: ${finalUrl}`);
    }

    // Check for pending requests
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest as Promise<T | undefined>;
    }

    const requestPromise = this.executeRequest<T>(
      finalUrl,
      method,
      finalOptions
    );
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      return await requestPromise;
    } finally {
      if (DEBUG) {
        console.info(`Request completed: ${finalUrl}`);
      }
      this.pendingRequests.delete(cacheKey);
    }
  }

  static async get<T>(
    url: string,
    options?: RequestOptions
  ): Promise<T | undefined> {
    return this.send<T>(url, "GET", options);
  }

  static async post<T>(
    url: string,
    options?: RequestOptions
  ): Promise<T | undefined> {
    return this.send<T>(url, "POST", options);
  }
}

// Export the public API
export default {
  send: Request.send.bind(Request),
  get: Request.get.bind(Request),
  post: Request.post.bind(Request),
};
