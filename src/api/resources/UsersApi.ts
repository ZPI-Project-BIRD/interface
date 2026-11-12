import type { ApiClient, ApiMethodOptions } from "../client/ApiClient";
import type { OrganizationUser, CreateUnassignedUserPayload, CreatedUnassignedUser } from "../contracts/users";

export class UsersApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async createUnassigned(payload: CreateUnassignedUserPayload): Promise<CreatedUnassignedUser> {
    return this.client.post("/organizations/null/users", payload);
  }

  async getAll(organizationId: string, options?: ApiMethodOptions): Promise<OrganizationUser[]> {
    return await this.client.get(`/organizations/${organizationId}/users`, options);
  }
}
