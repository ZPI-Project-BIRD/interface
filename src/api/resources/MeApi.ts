import type { ApiClient, ApiMethodOptions } from "../client/ApiClient";
import type {
  CurrentUser,
  UpdateFullNamePayload,
  UpdatePasswordPayload,
} from "../contracts/me";

export class MeApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async get(options?: ApiMethodOptions): Promise<CurrentUser> {
    return await this.client.get("/me", options);
  }

  async updateFullName(payload: UpdateFullNamePayload): Promise<CurrentUser> {
    return await this.client.patch("/me/full-name", payload);
  }

  async updatePassword(payload: UpdatePasswordPayload): Promise<void> {
    return await this.client.patch("/me/password", payload);
  }
}
