import type { ApiClient, ApiMethodOptions } from "../client/ApiClient";
import type {
  CreateProjectPayload,
  FeatureDetections,
  Project,
  ProjectProgress,
  DiscoveryStatus,
  DetectionState,
  PolygonCoordinates,
  AnnotationHistoryEntry,
  SourceFeature,
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

  async delete(
    organizationId: string,
    projectId: string,
    options?: ApiMethodOptions,
  ): Promise<void> {
    return await this.client.delete(
      `/organizations/${organizationId}/projects/${projectId}`,
      options,
    );
  }

  getFeatures(organizationId: string, projectId: string, options?: ApiMethodOptions): Promise<SourceFeature[]> {
    return this.client.get(`${this.projectPath(organizationId, projectId)}/features`, options);
  }

  retryDetections(organizationId: string, projectId: string): Promise<{ requeuedJobs: number }> {
    return this.client.post(`${this.projectPath(organizationId, projectId)}/detections/retry`);
  }

  retryDiscovery(organizationId: string, projectId: string): Promise<DiscoveryStatus> {
    return this.client.post(`${this.projectPath(organizationId, projectId)}/discovery/retry`);
  }

  createDetection(organizationId: string, projectId: string, featureId: string, bounds: PolygonCoordinates[]): Promise<DetectionState> {
    return this.client.post(`${this.projectPath(organizationId, projectId)}/detections`, { featureId, bounds });
  }

  updateDetection(organizationId: string, projectId: string, detectionId: string, expectedVersion: number, bounds: PolygonCoordinates[]): Promise<DetectionState> {
    return this.client.patch(`${this.detectionPath(organizationId, projectId, detectionId)}`, { expectedVersion, bounds });
  }

  deleteDetection(organizationId: string, projectId: string, detectionId: string, expectedVersion: number): Promise<void> {
    return this.client.delete(`${this.detectionPath(organizationId, projectId, detectionId)}?expectedVersion=${expectedVersion}`);
  }

  verifyDetection(organizationId: string, projectId: string, detectionId: string, expectedVersion: number, verified: boolean): Promise<DetectionState> {
    return this.client.patch(`${this.detectionPath(organizationId, projectId, detectionId)}/verification`, { expectedVersion, verified });
  }

  getAnnotationHistory(organizationId: string, projectId: string,
    { detectionId, limit = 100, offset = 0 }: { detectionId?: string; limit?: number; offset?: number } = {},
    options?: ApiMethodOptions): Promise<AnnotationHistoryEntry[]> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (detectionId) params.set("detectionId", detectionId);
    return this.client.get(`${this.projectPath(organizationId, projectId)}/annotation-history?${params}`, options);
  }

  private projectPath(organizationId: string, projectId: string) {
    return `/organizations/${encodeURIComponent(organizationId)}/projects/${encodeURIComponent(projectId)}`;
  }

  private detectionPath(organizationId: string, projectId: string, detectionId: string) {
    return `${this.projectPath(organizationId, projectId)}/detections/${encodeURIComponent(detectionId)}`;
  }
}
