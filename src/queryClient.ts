import { isCancelledError, QueryClient } from "react-query";
import { ApiError } from "./api/client/ApiError";

export function privateQueryKey(sessionId: number, ...parts: unknown[]) {
  return ["private", sessionId, ...parts] as const;
}

export function createSessionQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (isCancelledError(error) || (error instanceof Error && error.name === "AbortError")) {
            return false;
          }
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            return false;
          }
          return failureCount < 3;
        },
      },
    },
  });
}
