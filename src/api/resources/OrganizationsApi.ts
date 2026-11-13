import type { ApiClient, ApiMethodOptions } from "../client/ApiClient";
import type { Organization, OrganizationMembership } from "../contracts/organizations";
import type {
  CreateOrganizationUserPayload,
  CreatedOrganizationUser,
  OrganizationRole,
} from "../contracts/users";

export class OrganizationsApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async create(name: string): Promise<Organization> {
    return this.client.post("/organizations", { name });
  }

  getAll(options?: ApiMethodOptions): Promise<Organization[]> {
    return this.client.get("/organizations", options);
  }

  rename(organizationId: string, name: string): Promise<Organization> {
    return this.client.patch(`/organizations/${encodeURIComponent(organizationId)}`, { name });
  }

  delete(organizationId: string): Promise<void> {
    return this.client.delete(`/organizations/${encodeURIComponent(organizationId)}`);
  }

  addMembership(organizationId: string, userId: string, membershipRole: OrganizationRole): Promise<OrganizationMembership> {
    return this.client.post(`/organizations/${encodeURIComponent(organizationId)}/memberships`, { userId, membershipRole });
  }

  updateUserRole(organizationId: string, username: string, membershipRole: OrganizationRole): Promise<OrganizationMembership> {
    return this.client.patch(`/organizations/${encodeURIComponent(organizationId)}/users/${encodeURIComponent(username)}/role`, { membershipRole });
  }

  async updateUserFullName(organizationId: string, username: string, fullName: string) {
    return this.client.patch(`/organizations/${organizationId}/users/${encodeURIComponent(username)}/full-name`, { fullName });
  }

  async updateUserPassword(organizationId: string, username: string, newPassword: string) {
    return this.client.patch(`/organizations/${organizationId}/users/${encodeURIComponent(username)}/password`, { newPassword });
  }

  async getMy(options?: ApiMethodOptions): Promise<OrganizationMembership[]> {
    return await this.client.get("/organizations/my", options);
  }

  async getOwned(options?: ApiMethodOptions): Promise<Organization[]> {
    return await this.client.get("/organizations/owned", options);
  }

  async getEditable(options?: ApiMethodOptions): Promise<Organization[]> {
    return await this.client.get("/organizations/editable", options);
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
