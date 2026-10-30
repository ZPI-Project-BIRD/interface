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

export interface CreateOrganizationUserPayload {
  friendlyName: string;
  username: string;
  membershipRole: OrganizationRole;
}

export interface CreatedOrganizationUser {
  user: OrganizationUser;
  password: string;
}
