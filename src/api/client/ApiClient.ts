import { ApiError } from "./ApiError";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface CsrfResponse {
  headerName: string;
  token: string;
}

interface ApiClientOptions {
  baseUrl: string;
  credentials?: RequestCredentials;
  headers?: HeadersInit;
  csrfPath?: string;
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export type ApiMethodOptions = Omit<ApiRequestOptions, "body" | "method">;
type UnauthorizedHandler = () => void;

export class ApiClient {
  private readonly baseUrl: string;
  private readonly credentials: RequestCredentials;
  private readonly headers: Headers;
  private readonly csrfPath: string;
  private unauthorizedHandler?: UnauthorizedHandler;
  private sessionController = new AbortController();

  constructor({
    baseUrl,
    credentials = "same-origin",
    headers,
    csrfPath = "/auth/csrf",
  }: ApiClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.credentials = credentials;
    this.headers = new Headers(headers);
    this.csrfPath = csrfPath;
  }

  get<TResponse>(path: string, options?: ApiMethodOptions) {
    return this.request<TResponse>(path, { ...options, method: "GET" });
  }

  post<TResponse>(path: string, body?: unknown, options?: ApiMethodOptions) {
    return this.request<TResponse>(path, { ...options, method: "POST", body });
  }

  put<TResponse>(path: string, body?: unknown, options?: ApiMethodOptions) {
    return this.request<TResponse>(path, { ...options, method: "PUT", body });
  }

  patch<TResponse>(path: string, body?: unknown, options?: ApiMethodOptions) {
    return this.request<TResponse>(path, { ...options, method: "PATCH", body });
  }

  delete<TResponse>(path: string, options?: ApiMethodOptions) {
    return this.request<TResponse>(path, { ...options, method: "DELETE" });
  }

  setUnauthorizedHandler(handler: UnauthorizedHandler) {
    this.unauthorizedHandler = handler;
  }

  resetSession() {
    this.sessionController.abort(new DOMException("The session changed.", "AbortError"));
    this.sessionController = new AbortController();
  }

  async request<TResponse>(
    path: string,
    { body, headers, ...options }: ApiRequestOptions = {},
  ): Promise<TResponse> {
    const signal = options.signal
      ? AbortSignal.any([this.sessionController.signal, options.signal])
      : this.sessionController.signal;
    signal.throwIfAborted();
    const requestHeaders = new Headers(this.headers);

    new Headers(headers).forEach((value, key) => {
      requestHeaders.set(key, value);
    });

    if (body !== undefined && !requestHeaders.has("Content-Type")) {
      requestHeaders.set("Content-Type", "application/json");
    }

    const method = (options.method ?? "GET").toUpperCase();

    if (UNSAFE_METHODS.has(method)) {
      const csrf = await this.fetchCsrfToken({
        credentials: options.credentials,
        signal,
      });

      requestHeaders.set(csrf.headerName, csrf.token);
    }

    signal.throwIfAborted();

    let response: Response;

    try {
      response = await fetch(this.createUrl(path), {
        ...options,
        signal,
        credentials: options.credentials ?? this.credentials,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new ApiError(0, "Unable to connect to the server.");
    }

    signal.throwIfAborted();
    const responseBody = await this.readResponseBody(response);
    signal.throwIfAborted();

    if (!response.ok) {
      if (response.status === 401) {
        this.unauthorizedHandler?.();
      }

      throw new ApiError(
        response.status,
        this.extractErrorMessage(responseBody) ?? `Request failed with status ${response.status}.`,
        responseBody,
      );
    }

    return responseBody as TResponse;
  }

  private createUrl(path: string) {
    return `${this.baseUrl}/${path.replace(/^\//, "")}`;
  }

  private async fetchCsrfToken(options: Pick<RequestInit, "credentials" | "signal">) {
    let csrf: CsrfResponse;

    try {
      csrf = await this.get<CsrfResponse>(this.csrfPath, options);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new ApiError(
          error.status,
          `Could not obtain CSRF token${error.status ? `: HTTP ${error.status}` : "."}`,
          error.details,
        );
      }

      throw error;
    }

    if (
      typeof csrf !== "object" ||
      csrf === null ||
      typeof csrf.headerName !== "string" ||
      !csrf.headerName ||
      typeof csrf.token !== "string" ||
      !csrf.token
    ) {
      throw new ApiError(0, "The server returned an invalid CSRF token response.", csrf);
    }

    return csrf;
  }

  private async readResponseBody(response: Response): Promise<unknown> {
    if (response.status === 204) {
      return undefined;
    }

    const text = await response.text();

    if (!text) {
      return undefined;
    }

    if (response.headers.get("content-type")?.includes("application/json")) {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    }

    return text;
  }

  private extractErrorMessage(body: unknown) {
    if (
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      return body.message;
    }

    return undefined;
  }
}
