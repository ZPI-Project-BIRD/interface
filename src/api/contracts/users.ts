export interface OrganizationUser {
  id: string;
  friendlyName: string;
  username: string;
  isAdmin: boolean;
  bannedAt: string | null;
  banReason: string | null;
  membershipRole: string;
}
