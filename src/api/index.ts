import { ApiClient } from "./client/ApiClient";
import { AuthApi } from "./resources/AuthApi";
import { OrganizationsApi } from "./resources/OrganizationsApi";
import { ProjectsApi } from "./resources/ProjectsApi";

export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "/api",
  credentials: "include",
});

export const api = {
  auth: new AuthApi(apiClient),
  projects: new ProjectsApi(apiClient),
  organizations: new OrganizationsApi(apiClient),
};

export { ApiClient } from "./client/ApiClient";
export { ApiError } from "./client/ApiError";
export { AuthApi } from "./resources/AuthApi";
export type { AuthenticatedUser, LoginCredentials } from "./contracts/auth";
export type { Organization, OrganizationMembership } from "./contracts/organizations";
export type { CreateProjectPayload, Point, Project } from "./contracts/projects";
