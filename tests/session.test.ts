import { afterAll, afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { isCancelledError, setLogger } from "react-query";
import { apiClient, ApiError } from "../src/api";
import { privateQueryKey } from "../src/queryClient";
import { isCurrentSession, useAuthStore, withSession } from "../src/stores/authStore";
import { annotationDraftKey, type AnnotationDraft } from "../src/projects/annotationDrafts";

const alice = { username: "alice", authorities: [] };
const bob = { username: "bob", authorities: [] };
const csrf = { headerName: "X-XSRF-TOKEN", token: "test-token" };
const calls: { path: string; options?: RequestInit }[] = [];
type Handler = (path: string, options?: RequestInit) => Promise<Response>;
let handler: Handler;
let fetchSpy: ReturnType<typeof spyOn>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

async function defaultHandler(path: string, options?: RequestInit) {
  if (path.endsWith("/auth/csrf")) return Response.json(csrf);
  if (path.endsWith("/auth/login")) {
    const { username } = JSON.parse(options!.body as string);
    return Response.json({ username, authorities: [] });
  }
  if (path.endsWith("/auth/logout")) return new Response(null, { status: 204 });
  if (path.endsWith("/auth/me")) return Response.json(alice);
  return Response.json({ message: "Not found" }, { status: 404 });
}

async function login(username = "alice") {
  await useAuthStore.getState().login({ username, password: "test-password" });
  return useAuthStore.getState();
}

beforeEach(() => {
  setLogger({ log() {}, warn() {}, error() {} });
  useAuthStore.getState().clearSession();
  useAuthStore.setState({ initialized: false });
  calls.length = 0;
  handler = defaultHandler;
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation((input, options) => {
    const path = new URL(String(input), "http://frontend.test").pathname;
    calls.push({ path, options });
    return handler(path, options);
  });
});

afterEach(() => {
  useAuthStore.getState().clearSession();
  fetchSpy.mockRestore();
});
afterAll(() => { setLogger(console); });

const outlineDraft: AnnotationDraft = { id: "result", featureId: "sheet", expectedVersion: 7, crs: "EPSG:2180",
  bounds: [[[[0, 0], [10, 0], [10, 10], [0, 0]]]] };

test("kept drafts retain geometry and versions separately for each project and organization", async () => {
  const session = await login();
  const first = annotationDraftKey({ organizationId: "A", id: "project" });
  const second = annotationDraftKey({ organizationId: "B", id: "project" });
  session.setAnnotationDraft(session.sessionId, first, outlineDraft);
  session.setAnnotationDraft(session.sessionId, second, { ...outlineDraft, expectedVersion: 2 });
  session.setAnnotationDraft(session.sessionId, first, (draft) => ({ ...draft!, featureId: "corrected-sheet" }));
  expect(useAuthStore.getState().annotationDrafts[first]).toMatchObject({ expectedVersion: 7, bounds: outlineDraft.bounds, featureId: "corrected-sheet" });
  session.setAnnotationDraft(session.sessionId, first, undefined);
  expect(useAuthStore.getState().annotationDrafts[first]).toBeUndefined();
  expect(useAuthStore.getState().annotationDrafts[second].expectedVersion).toBe(2);
});

test("logging out clears drafts and stale callbacks cannot restore them for the next user", async () => {
  const session = await login();
  session.setAnnotationDraft(session.sessionId, "project", outlineDraft);
  await session.logout();
  expect(useAuthStore.getState().annotationDrafts).toEqual({});
  await login("bob");
  session.setAnnotationDraft(session.sessionId, "project", outlineDraft);
  expect(useAuthStore.getState().annotationDrafts).toEqual({});
});

test("session expiration clears all unsaved annotation drafts", async () => {
  const session = await login();
  session.setAnnotationDraft(session.sessionId, "project", outlineDraft);
  session.clearSession(true);
  expect(useAuthStore.getState().annotationDrafts).toEqual({});
  expect(useAuthStore.getState().sessionExpired).toBe(true);
});

test("logout clears query/mutation data before another user signs in", async () => {
  const a = await login();
  a.queryClient.setQueryData(privateQueryKey(a.sessionId, "projects"), ["Alice's private project"]);
  await a.queryClient.executeMutation({ mutationFn: async () => "Alice's private mutation result" });
  expect(a.queryClient.getMutationCache().getAll()).toHaveLength(1);

  await a.logout();
  expect(a.queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(a.queryClient.getMutationCache().getAll()).toHaveLength(0);
  expect(useAuthStore.getState().user).toBeNull();

  const b = await login("bob");
  expect(b.user).toEqual(bob);
  expect(b.queryClient).not.toBe(a.queryClient);
  expect(b.queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(privateQueryKey(b.sessionId, "project", "same-id"))
    .not.toEqual(privateQueryKey(a.sessionId, "project", "same-id"));
});

test("a slow query is aborted and cannot populate Bob's cache even if fetch ignores abort", async () => {
  const a = await login();
  const response = deferred<Response>();
  const started = deferred<AbortSignal>();
  handler = (path, options) => {
    if (path.endsWith("/slow-projects")) {
      started.resolve(options!.signal!);
      return response.promise;
    }
    return defaultHandler(path, options);
  };
  const pending = a.queryClient.fetchQuery(
    privateQueryKey(a.sessionId, "projects"),
    ({ signal }) => apiClient.get("/slow-projects", { signal }),
  ).catch((error) => error);
  const signal = await started.promise;

  await a.logout();
  const b = await login("bob");
  expect(signal.aborted).toBe(true);
  response.resolve(Response.json(["Alice's delayed data"]));
  expect(isCancelledError(await pending)).toBe(true);
  expect(a.queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(b.queryClient.getQueryCache().getAll()).toHaveLength(0);
});

test("a delayed 401 body from an old session cannot expire the new session", async () => {
  const a = await login();
  const body = deferred<string>();
  const readingBody = deferred<void>();
  const response = new Response(null, { status: 401, headers: { "Content-Type": "application/json" } });
  response.text = () => { readingBody.resolve(); return body.promise; };
  handler = (path, options) => path.endsWith("/slow-401")
    ? Promise.resolve(response) : defaultHandler(path, options);
  const pending = apiClient.get("/slow-401").catch((error) => error);
  await readingBody.promise;
  await a.logout();
  await login("bob");

  body.resolve('{"message":"Alice expired"}');
  expect((await pending).name).toBe("AbortError");
  expect(useAuthStore.getState().user).toEqual(bob);
  expect(useAuthStore.getState().sessionExpired).toBe(false);
});

test("an expired session clears private state and records a login-page notice", async () => {
  const a = await login();
  a.queryClient.setQueryData(privateQueryKey(a.sessionId, "account"), { fullName: "Alice" });
  handler = (path, options) => path.endsWith("/expired")
    ? Promise.resolve(Response.json({ message: "Expired" }, { status: 401 }))
    : defaultHandler(path, options);

  const error = await apiClient.get("/expired").catch((cause) => cause);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(401);
  expect(useAuthStore.getState().user).toBeNull();
  expect(useAuthStore.getState().sessionExpired).toBe(true);
  expect(a.queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(useAuthStore.getState().loading).toBe(false);
});

test("an initial anonymous 401 does not show a session-expired notice", async () => {
  handler = (path, options) => path.endsWith("/auth/me")
    ? Promise.resolve(new Response(null, { status: 401 })) : defaultHandler(path, options);
  await useAuthStore.getState().initialize();
  expect(useAuthStore.getState().initialized).toBe(true);
  expect(useAuthStore.getState().sessionExpired).toBe(false);
  expect(useAuthStore.getState().error).toBeNull();
});

test("invalid credentials stay a login error rather than an expiry", async () => {
  const guest = useAuthStore.getState();
  handler = (path, options) => path.endsWith("/auth/login")
    ? Promise.resolve(new Response(null, { status: 401 })) : defaultHandler(path, options);
  await expect(login()).rejects.toThrow("Invalid username or password.");
  expect(useAuthStore.getState().user).toBeNull();
  expect(useAuthStore.getState().sessionExpired).toBe(false);
  expect(useAuthStore.getState().loading).toBe(false);
  // Keep the login form and its message holder mounted while a guest tries to log in.
  expect(useAuthStore.getState().queryClient).toBe(guest.queryClient);
  expect(useAuthStore.getState().sessionId).toBe(guest.sessionId);
});

test("a forbidden logout keeps the current identity and a retryable error", async () => {
  await login();
  handler = (path, options) => path.endsWith("/auth/logout")
    ? Promise.resolve(new Response(null, { status: 403 })) : defaultHandler(path, options);
  await expect(useAuthStore.getState().logout()).rejects.toBeInstanceOf(ApiError);
  expect(useAuthStore.getState().user).toEqual(alice);
  expect(useAuthStore.getState().error).toBe("Request failed with status 403.");
  expect(useAuthStore.getState().loggingOut).toBe(false);
  expect(useAuthStore.getState().sessionExpired).toBe(false);
});

test("a caller's cancellation is preserved instead of becoming a connection error", async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await apiClient.get("/not-sent", { signal: controller.signal }).catch((error) => error);
  expect(result.name).toBe("AbortError");
  expect(calls).toHaveLength(0);
});

test("logout is pending, preserves the identity on failure, and can be retried", async () => {
  const a = await login();
  a.queryClient.setQueryData(privateQueryKey(a.sessionId, "projects"), ["private"]);
  const response = deferred<Response>();
  const started = deferred<void>();
  handler = (path, options) => {
    if (path.endsWith("/auth/logout")) { started.resolve(); return response.promise; }
    return defaultHandler(path, options);
  };
  const pending = a.logout().catch((error) => error);
  await started.promise;
  expect(useAuthStore.getState().loggingOut).toBe(true);
  expect(useAuthStore.getState().loading).toBe(true);
  expect(a.queryClient.getQueryCache().getAll()).toHaveLength(0);
  await useAuthStore.getState().logout();
  expect(calls.filter(({ path }) => path.endsWith("/auth/logout"))).toHaveLength(1);

  response.reject(new TypeError("Offline"));
  expect((await pending).status).toBe(0);
  expect(useAuthStore.getState().user).toEqual(alice);
  expect(useAuthStore.getState().loggingOut).toBe(false);
  expect(useAuthStore.getState().loading).toBe(false);
  expect(useAuthStore.getState().error).toBe("Unable to connect to the server.");
  handler = defaultHandler;
  await useAuthStore.getState().logout();
  expect(useAuthStore.getState().user).toBeNull();
  expect(useAuthStore.getState().error).toBeNull();
});

test("a 401 during logout is successful logout, without an expiry notice", async () => {
  await login();
  handler = (path, options) => path.endsWith("/auth/logout")
    ? Promise.resolve(new Response(null, { status: 401 })) : defaultHandler(path, options);
  await useAuthStore.getState().logout();
  expect(useAuthStore.getState().user).toBeNull();
  expect(useAuthStore.getState().sessionExpired).toBe(false);
  expect(useAuthStore.getState().loggingOut).toBe(false);
});

test("a mutation waiting for an old CSRF response cannot send a write in the new session", async () => {
  const a = await login();
  const response = deferred<Response>();
  const started = deferred<void>();
  let firstCsrf = true;
  handler = (path, options) => {
    if (firstCsrf && path.endsWith("/auth/csrf")) {
      firstCsrf = false;
      started.resolve();
      return response.promise;
    }
    return defaultHandler(path, options);
  };
  const write = apiClient.post("/old-write", { private: "Alice" }).catch((error) => error);
  await started.promise;
  await a.logout();
  await login("bob");
  response.resolve(Response.json(csrf));
  expect((await write).name).toBe("AbortError");
  expect(calls.some(({ path }) => path.endsWith("/old-write"))).toBe(false);
});

test("an in-flight mutation is cancelled and its stale callbacks do not update a cache", async () => {
  const a = await login();
  const result = deferred<string>();
  const started = deferred<void>();
  const onSuccess = mock(() => {});
  const mutation = a.queryClient.executeMutation({
    mutationKey: privateQueryKey(a.sessionId, "update-account"),
    mutationFn: () => withSession(a.sessionId, () => { started.resolve(); return result.promise; }),
    onSuccess,
    onError: () => {
      if (!isCurrentSession(a.sessionId)) return;
      a.queryClient.setQueryData(privateQueryKey(a.sessionId, "account"), "stale error");
    },
  }).catch((error) => error);
  await started.promise;
  await a.logout();
  const b = await login("bob");
  result.resolve("Alice's old mutation result");
  expect(isCancelledError(await mutation)).toBe(true);
  expect(onSuccess).not.toHaveBeenCalled();
  expect(a.queryClient.getMutationCache().getAll()).toHaveLength(0);
  expect(a.queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(b.queryClient.getMutationCache().getAll()).toHaveLength(0);
  expect(b.queryClient.getQueryCache().getAll()).toHaveLength(0);
});

test("a mutation queued before logout cannot start a request after the session changes", async () => {
  const a = await login();
  const send = mock(async () => "must not be sent");
  const pending = a.queryClient.executeMutation({
    mutationFn: () => withSession(a.sessionId, send),
  }).catch((error) => error);
  const logout = a.logout();
  await Promise.all([pending, logout]);
  expect(send).not.toHaveBeenCalled();
  expect(a.queryClient.getMutationCache().getAll()).toHaveLength(0);
});

test("identity changes clear the cache even when login happens without explicit logout", async () => {
  const a = await login();
  a.queryClient.setQueryData(privateQueryKey(a.sessionId, "project", "shared-id"), { owner: "alice" });
  const b = await login("bob");
  expect(b.user).toEqual(bob);
  expect(b.sessionId).not.toBe(a.sessionId);
  expect(a.queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(b.queryClient.getQueryData(privateQueryKey(b.sessionId, "project", "shared-id")))
    .toBeUndefined();
});

test("logging in again as the same user still gets a new cache scope", async () => {
  const a = await login();
  await a.logout();
  const next = await login();
  expect(next.user).toEqual(alice);
  expect(next.sessionId).not.toBe(a.sessionId);
  expect(next.queryClient).not.toBe(a.queryClient);
});

test("a late initialization response cannot replace a newer login", async () => {
  const response = deferred<Response>();
  const started = deferred<void>();
  handler = (path, options) => {
    if (path.endsWith("/auth/me")) { started.resolve(); return response.promise; }
    return defaultHandler(path, options);
  };
  const initializing = useAuthStore.getState().initialize();
  await started.promise;
  useAuthStore.getState().clearSession();
  await login("bob");
  response.resolve(Response.json(alice));
  await initializing;
  expect(useAuthStore.getState().user).toEqual(bob);
  expect(useAuthStore.getState().loading).toBe(false);
});
