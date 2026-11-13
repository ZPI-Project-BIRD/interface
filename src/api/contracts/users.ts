export interface OrganizationUser {
  id: string;
  friendlyName: string;
  username: string;
  isAdmin: boolean;
  bannedAt: string | null;
  banReason: string | null;
  membershipRole: string;
}

export type OrganizationRole = "VIEWER" | "ANNOTATOR" | "EDITOR" | "OWNER";

export type PlatformUser = Omit<OrganizationUser, "membershipRole"> & { membershipRole: null };

export interface UserSearch {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateOrganizationUserPayload {
  friendlyName: string;
  username: string;
  membershipRole: OrganizationRole;
}

export interface CreatedOrganizationUser {
  user: OrganizationUser;
  password: string;
}

export interface CreateUnassignedUserPayload {
  friendlyName: string;
  username: string;
  isAdmin: boolean;
}

export interface CreatedUnassignedUser {
  user: Omit<OrganizationUser, "membershipRole"> & { membershipRole: null };
  password: string;
}
