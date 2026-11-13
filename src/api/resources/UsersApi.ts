import type { ApiClient, ApiMethodOptions } from "../client/ApiClient";
import type { OrganizationUser, CreateUnassignedUserPayload, CreatedUnassignedUser, PlatformUser, UserSearch } from "../contracts/users";

export class UsersApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  search({ search = "", limit = 100, offset = 0 }: UserSearch = {}, options?: ApiMethodOptions): Promise<PlatformUser[]> {
    const params = new URLSearchParams({ search, limit: String(limit), offset: String(offset) });
    return this.client.get(`/users?${params}`, options);
  }

  ban(userId: string, reason: string): Promise<void> {
    return this.client.post(`/users/${encodeURIComponent(userId)}/ban`, { reason });
  }

  unban(userId: string): Promise<void> {
    return this.client.delete(`/users/${encodeURIComponent(userId)}/ban`);
  }

  async createUnassigned(payload: CreateUnassignedUserPayload): Promise<CreatedUnassignedUser> {
    return this.client.post("/organizations/null/users", payload);
  }

  async getAll(organizationId: string, options?: ApiMethodOptions): Promise<OrganizationUser[]> {
    return await this.client.get(`/organizations/${organizationId}/users`, options);
  }
}
