import { ApiClient } from "./client/ApiClient";
import { AuthApi } from "./resources/AuthApi";
import { OrganizationsApi } from "./resources/OrganizationsApi";
import { ProjectsApi } from "./resources/ProjectsApi";
import { UsersApi } from "./resources/UsersApi";
import { MeApi } from "./resources/MeApi";

export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_URL?.trim() || "/api",
  credentials: "include",
});

export const api = {
  auth: new AuthApi(apiClient),
  projects: new ProjectsApi(apiClient),
  organizations: new OrganizationsApi(apiClient),
  users: new UsersApi(apiClient),
  me: new MeApi(apiClient),
};

export { ApiClient } from "./client/ApiClient";
export { ApiError } from "./client/ApiError";
export { AuthApi } from "./resources/AuthApi";
export type { AuthenticatedUser, LoginCredentials } from "./contracts/auth";
export type { Organization, OrganizationMembership } from "./contracts/organizations";
export type {
  CreateProjectPayload,
  Detection,
  DetectionBounds,
  DetectionGeometry,
  DetectionType,
  LineCoordinates,
  FeatureDetections,
  Point,
  PolygonCoordinates,
  Project,
  ProjectProgress,
  QueuePosition,
  StageProgress,
  DiscoveryStatus,
  DetectionState,
  AnnotationHistoryEntry,
  SourceFeature,
} from "./contracts/projects";
export type {
  CreateOrganizationUserPayload,
  CreatedOrganizationUser,
  OrganizationRole,
  OrganizationUser,
  PlatformUser,
} from "./contracts/users";
export type {
  CurrentUser,
  UpdateFullNamePayload,
  UpdatePasswordPayload,
} from "./contracts/me";
