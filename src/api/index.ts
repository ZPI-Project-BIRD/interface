import { ApiClient } from "./client/ApiClient";
import { AuthApi } from "./resources/AuthApi";
import { OrganizationsApi } from "./resources/OrganizationsApi";
import { ProjectsApi } from "./resources/ProjectsApi";

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "/api",
  credentials: "include",
});

export const api = {
  auth: new AuthApi(client),
  projects: new ProjectsApi(client),
  organizations: new OrganizationsApi(client),
};

export { ApiClient } from "./client/ApiClient";
export { ApiError } from "./client/ApiError";
export { AuthApi } from "./resources/AuthApi";
export type { LoginCredentials } from "./contracts/auth";
