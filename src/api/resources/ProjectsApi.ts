import type { ApiClient } from "../client/ApiClient";
import type { CreateProjectPayload, Project } from "../contracts/projects";

export class ProjectsApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async create(organizationId: string, payload: CreateProjectPayload): Promise<Project> {
    return await this.client.post(`/organizations/${organizationId}/projects`, payload);
  }

  async getAll(organizationId: string): Promise<Project[]> {
    return await this.client.get(`/organizations/${organizationId}/projects`);
  }
}
