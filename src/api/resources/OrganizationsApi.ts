import type { ApiClient } from "../client/ApiClient";

export class OrganizationsApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async getMy() {
    return await this.client.get("/organizations/my");
  }
}
