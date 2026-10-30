import type { ApiClient } from "../client/ApiClient";
import type { OrganizationUser } from "../contracts/users";

export class UsersApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async getAll(organizationId: string): Promise<OrganizationUser[]> {
    return await this.client.get(`/organizations/${organizationId}/users`);
  }
}
