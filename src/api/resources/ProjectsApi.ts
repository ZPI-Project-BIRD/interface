import type { ApiClient } from "../client/ApiClient";

export interface Point {
  latitude: number;
  longitude: number;
}

export interface CreateProjectPayload {
  name: string;
  topLeft: Point;
  bottomRight: Point;
}

export class ProjectsApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async create(organizationId: string, payload: CreateProjectPayload) {
    return await this.client.post(
      `/api/organizations/${organizationId}/projects`,
      JSON.stringify(payload),
    );
  }

  async getAll(organizationId: string) {
    return await this.client.get(`/api/organizations/${organizationId}/projects`);
  }
}
