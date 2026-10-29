import type { ApiClient } from "../client/ApiClient";
import type { Organization, OrganizationMembership } from "../contracts/organizations";

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
}
