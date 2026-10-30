import type { ApiClient } from "../client/ApiClient";
import type { Organization, OrganizationMembership } from "../contracts/organizations";
import type {
  CreateOrganizationUserPayload,
  CreatedOrganizationUser,
} from "../contracts/users";

export class OrganizationsApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async getMy(): Promise<OrganizationMembership[]> {
    return await this.client.get("/organizations/my");
  }

  async getOwned(): Promise<Organization[]> {
    return await this.client.get("/organizations/owned");
  }

  async getEditable(): Promise<Organization[]> {
    return await this.client.get("/organizations/editable");
  }

  async removeUser(organizationId: string, username: string) {
    return await this.client.delete(
      `/organizations/${organizationId}/users/${encodeURIComponent(username)}`,
    );
  }

  async createUser(
    organizationId: string,
    payload: CreateOrganizationUserPayload,
  ): Promise<CreatedOrganizationUser> {
    return await this.client.post(`/organizations/${organizationId}/users`, payload);
  }
}
