const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  useAdminToken?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private isRelative: boolean;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.isRelative = !baseUrl.startsWith("http");
  }

  private getToken(useAdmin?: boolean): string | null {
    if (typeof window === "undefined") return null;
    if (useAdmin) {
      return localStorage.getItem("admin_access_token");
    }
    return localStorage.getItem("access_token");
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    let urlStr: string;
    if (this.isRelative) {
      urlStr = `${this.baseUrl}${path}`;
    } else {
      const url = new URL(`${this.baseUrl}${path}`);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            url.searchParams.set(key, String(value));
          }
        });
      }
      return url.toString();
    }

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
      const separator = urlStr.includes("?") ? "&" : "?";
      urlStr += searchParams.toString() ? `${separator}${searchParams.toString()}` : "";
    }
    return urlStr;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers: customHeaders, useAdminToken, ...restOptions } = options;
    const url = this.buildUrl(path, params);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(customHeaders as Record<string, string>),
    };

    const token = this.getToken(useAdminToken);
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...restOptions,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ApiError(response.status, error.detail || "请求失败", error);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>, useAdminToken?: boolean): Promise<T> {
    return this.request<T>(path, { method: "GET", params, useAdminToken });
  }

  async post<T>(path: string, data?: unknown, useAdminToken?: boolean): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
      useAdminToken,
    });
  }

  async put<T>(path: string, data?: unknown, useAdminToken?: boolean): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
      useAdminToken,
    });
  }

  async delete<T>(path: string, useAdminToken?: boolean): Promise<T> {
    return this.request<T>(path, { method: "DELETE", useAdminToken });
  }

  async upload<T>(path: string, formData: FormData, useAdminToken?: boolean): Promise<T> {
    const token = this.getToken(useAdminToken);
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(this.buildUrl(path), {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ApiError(response.status, error.detail || "上传失败", error);
    }

    return response.json();
  }

  getStreamUrl(path: string, token?: string): string {
    const urlStr = this.buildUrl(path);
    if (token) {
      const separator = urlStr.includes("?") ? "&" : "?";
      return `${urlStr}${separator}token=${token}`;
    }
    return urlStr;
  }
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "ApiError";
  }
}

const API_BASE_URL = NEXT_PUBLIC_API_URL || "";
export const apiClient = new ApiClient(`${API_BASE_URL}/api/v1`);
