import type { ApiClient } from "../client/ApiClient";
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

  async get(): Promise<CurrentUser> {
    return await this.client.get("/me");
  }

  async updateFullName(payload: UpdateFullNamePayload): Promise<CurrentUser> {
    return await this.client.patch("/me/full-name", payload);
  }

  async updatePassword(payload: UpdatePasswordPayload): Promise<void> {
    return await this.client.patch("/me/password", payload);
  }
}
