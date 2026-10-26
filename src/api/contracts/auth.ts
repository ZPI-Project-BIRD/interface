export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthenticatedUser {
  username: string;
  authorities: string[];
}
