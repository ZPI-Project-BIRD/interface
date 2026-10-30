export interface CurrentUser {
  id: string;
  fullName: string;
  username: string;
  isAdmin: boolean;
}

export interface UpdateFullNamePayload {
  fullName: string;
}

export interface UpdatePasswordPayload {
  currentPassword: string;
  newPassword: string;
}
