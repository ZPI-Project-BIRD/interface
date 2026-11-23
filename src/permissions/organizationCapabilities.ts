import type { AuthenticatedUser, OrganizationMembership, OrganizationRole, OrganizationUser } from "../api";
import { ApiError } from "../api/client/ApiError";

export function isAdministrator(user: AuthenticatedUser | null) {
  return user?.authorities.includes("ROLE_ADMIN") ?? false;
}

export function isPermissionDenied(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

export function organizationCapabilities(
  user: AuthenticatedUser | null,
  membership?: OrganizationMembership,
) {
  const administrator = isAdministrator(user);
  const role = membership?.role.replace(/^_?\d+_/, "");
  const canManage = administrator || Boolean(user && role === "OWNER");
  return {
    administrator,
    canRead: administrator || Boolean(user && role && ["VIEWER", "ANNOTATOR", "EDITOR", "OWNER"].includes(role)),
    canCreateProject: administrator || Boolean(user && (role === "EDITOR" || role === "OWNER")),
    canRetryProcessing: administrator || Boolean(user && (role === "EDITOR" || role === "OWNER")),
    canAnnotate: administrator || Boolean(user && role && ["ANNOTATOR", "EDITOR", "OWNER"].includes(role)),
    canReviewHistory: canManage,
    canDeleteProject: canManage,
    canManageUsers: canManage,
    canEditUsers: administrator,
    canCreateOrganization: administrator,
    canCreateUnassignedAccount: administrator,
    userRoles: (canManage ? administrator ? ["VIEWER", "ANNOTATOR", "EDITOR", "OWNER"] : ["VIEWER", "ANNOTATOR", "EDITOR"] : []) as OrganizationRole[],
    canChangeRole: (target: OrganizationUser) => canManage && (administrator || !target.membershipRole.includes("OWNER")),
    canRemoveUser: (target: OrganizationUser) =>
      canManage && target.username !== user?.username &&
      (administrator || !target.membershipRole.includes("OWNER")),
  };
}
