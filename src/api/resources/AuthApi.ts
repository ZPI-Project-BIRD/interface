import type { AuthenticatedUser, LoginCredentials } from "../contracts/auth";
import type { ApiClient } from "../client/ApiClient";
import { ApiError } from "../client/ApiError";

export class AuthApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async login({ username, password }: LoginCredentials): Promise<AuthenticatedUser> {
    try {
      return await this.client.post<AuthenticatedUser>("/auth/login", { username, password });
    } catch (error) {
      this.rethrowWithMessage(error, {
        401: "Invalid username or password.",
        fallback: "Unable to log in.",
      });
    }
  }

  me(options?: { signal?: AbortSignal }) {
    return this.client.get<AuthenticatedUser>("/auth/me", options);
  }

  logout(): Promise<void> {
    return this.client.post<void>("/auth/logout");
  }

  private rethrowWithMessage(
    error: unknown,
    messages: Record<number, string> & { fallback: string },
  ): never {
    if (!(error instanceof ApiError) || error.status === 0) {
      throw error;
    }

    throw new ApiError(error.status, messages[error.status] ?? messages.fallback, error.details);
  }
}
