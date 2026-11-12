export interface Organization {
  id: string;
  name: string;
}

export interface OrganizationMembership {
  organization: Organization;
  role: string;
}
