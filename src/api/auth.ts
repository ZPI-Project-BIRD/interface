export interface LoginCredentials {
  email: string;
  password: string;
}

export async function login({
  email,
  password,
}: LoginCredentials): Promise<void> {
  let response: Response;

  try {
    response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Unable to connect to the server.");
  }

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Invalid email or password."
        : "Unable to log in.",
    );
  }
}

export async function register({ email, password }: LoginCredentials): Promise<void> {
  let response: Response;

  try {
    response = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Unable to connect to the server.");
  }

  if (!response.ok) {
    throw new Error(
      response.status === 409
        ? "An account with this email already exists."
        : "Unable to create your account. Please check your details and try again.",
    );
  }
}
