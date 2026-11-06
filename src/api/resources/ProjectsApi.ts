import type { ApiClient, ApiMethodOptions } from "../client/ApiClient";
import type {
  CreateProjectPayload,
  FeatureDetections,
  Project,
  ProjectProgress,
} from "../contracts/projects";

export class ProjectsApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async findById(
    organizationId: string,
    projectId: string,
    options?: ApiMethodOptions,
  ): Promise<Project> {
    return await this.client.get(`/organizations/${organizationId}/projects/${projectId}`, options);
  }

  async create(organizationId: string, payload: CreateProjectPayload): Promise<Project> {
    return await this.client.post(`/organizations/${organizationId}/projects`, payload);
  }

  async getAll(organizationId: string, options?: ApiMethodOptions): Promise<Project[]> {
    return await this.client.get(`/organizations/${organizationId}/projects`, options);
  }

  async getProgress(
    organizationId: string,
    projectId: string,
    options?: ApiMethodOptions,
  ): Promise<ProjectProgress> {
    return await this.client.get(
      `/organizations/${organizationId}/projects/${projectId}/progress`,
      options,
    );
  }

  async getDetections(
    organizationId: string,
    projectId: string,
    options?: ApiMethodOptions,
  ): Promise<FeatureDetections[]> {
    return await this.client.get(
      `/organizations/${organizationId}/projects/${projectId}/detections`,
      options,
    );
  }
}
