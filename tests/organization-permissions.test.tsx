import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClientProvider, QueryObserver, setLogger } from "react-query";
import { createMemoryRouter, RouterProvider, Outlet, Route, Routes } from "react-router";
import { api, ApiError, type OrganizationMembership, type OrganizationUser } from "../src/api";
import { organizationCapabilities } from "../src/permissions/organizationCapabilities";
import { reportOrganizationDenial, useOrganizationCapabilities } from "../src/hooks/useOrganizationCapabilities";
import { useAuthStore } from "../src/stores/authStore";
import { privateQueryKey } from "../src/queryClient";
import { RequireAdministrator, RequireOrganizationOwner, RequireProjectCreator } from "../src/components/AuthRouteGuards";
import { AccessFeedback } from "../src/components/AccessFeedback";
import { AccountAccess } from "../src/components/AccountAccess";
import { describeOrganizationAccess } from "../src/permissions/accessDescriptions";

const user = { username: "current", authorities: ["ROLE_USER"] };
const admin = { username: "current", authorities: ["ROLE_ADMIN"] };
const target = { id: "target", username: "other", friendlyName: "Other", membershipRole: "_1_VIEWER", isAdmin: false, bannedAt: null, banReason: null } satisfies OrganizationUser;
function membership(role: string, id = "selected"): OrganizationMembership {
  return { organization: { id, name: `Organization ${id}` }, role };
}

beforeEach(() => {
  setLogger({ log() {}, warn() {}, error() {} });
  useAuthStore.getState().clearSession();
  useAuthStore.setState({ user, initialized: true });
});
afterEach(() => { useAuthStore.getState().clearSession(); setLogger(console); });

for (const [role, create, manage] of [
  ["_1_VIEWER", false, false], ["_2_ANNOTATOR", false, false],
  ["_3_EDITOR", true, false], ["_4_OWNER", true, true],
] as const) {
  test(`${role} follows the selected organization action matrix`, () => {
    const caps = organizationCapabilities(user, membership(role));
    expect(caps.canRead).toBe(true);
    expect(caps.canCreateProject).toBe(create);
    expect(caps.canDeleteProject).toBe(manage);
    expect(caps.canManageUsers).toBe(manage);
    expect(caps.userRoles).toEqual(manage ? ["VIEWER", "ANNOTATOR", "EDITOR"] : []);
    expect(caps.canRemoveUser(target)).toBe(manage);
    expect(caps.canRemoveUser({ ...target, membershipRole: "_4_OWNER" })).toBe(false);
    expect(caps.canRemoveUser({ ...target, username: user.username })).toBe(false);
    expect(caps.canEditUsers).toBe(false);
    expect(caps.canCreateOrganization).toBe(false);
    expect(caps.canCreateUnassignedAccount).toBe(false);
  });
}

test("administrator needs no membership and can remove another owner but never self", () => {
  const caps = organizationCapabilities(admin);
  expect([caps.canRead, caps.canCreateProject, caps.canDeleteProject, caps.canManageUsers, caps.canEditUsers, caps.canCreateOrganization, caps.canCreateUnassignedAccount]).toEqual(Array(7).fill(true));
  expect(caps.userRoles).toEqual(["VIEWER", "ANNOTATOR", "EDITOR", "OWNER"]);
  expect(caps.canRemoveUser({ ...target, membershipRole: "_4_OWNER" })).toBe(true);
  expect(caps.canRemoveUser({ ...target, username: admin.username })).toBe(false);
});

// Use the session snapshot for server-rendered components in these tests.
const originalInitialState = useAuthStore.getInitialState;
function render(element: React.ReactNode, path = "/") {
  const initialSnapshot = { ...originalInitialState() };
  Object.assign(originalInitialState(), useAuthStore.getState());
  try {
    const router = createMemoryRouter([{ path: "*", element }], { initialEntries: [path] });
    try {
      return renderToStaticMarkup(<QueryClientProvider client={useAuthStore.getState().queryClient}><RouterProvider router={router} /></QueryClientProvider>);
    } finally { router.dispose(); }
  } finally { Object.assign(originalInitialState(), initialSnapshot); }
}
function seed(memberships: OrganizationMembership[]) {
  const state = useAuthStore.getState();
  state.queryClient.setQueryData(privateQueryKey(state.sessionId, "organizations", "my"), memberships);
}

test("Account shows each organization's role and permitted actions without administrator privileges", () => {
  seed([membership("1_VIEWER", "A"), membership("_2_ANNOTATOR", "B"), membership("3_EDITOR", "C"), membership("4_OWNER", "D")]);
  const html = render(<AccountAccess />);
  for (const name of ["Organization A", "Organization B", "Organization C", "Organization D", "Viewer", "Annotator", "Editor", "Owner"]) expect(html).toContain(name);
  expect(html).toContain("review annotation history");
  expect(html).toContain("retry processing");
  expect(html).toContain("Standard account");
  expect(html).not.toContain("You can administer all organizations");
});

test("Account explains global administrator access even with no organization memberships", () => {
  useAuthStore.setState({ user: admin });
  seed([]);
  const html = render(<AccountAccess />);
  expect(html).toContain("Global administrator");
  expect(html).toContain("You do not belong to any organizations");
  expect(html).toContain("Your global administrator access still applies");
});

test("Account hides stale memberships and shows an error when access refresh fails", async () => {
  seed([membership("4_OWNER")]);
  const { queryClient, sessionId } = useAuthStore.getState();
  await queryClient.fetchQuery(privateQueryKey(sessionId, "organizations", "my"), () => Promise.reject(new ApiError(500, "Offline")), { retry: false }).catch(() => {});
  const html = render(<AccountAccess />);
  expect(html).toContain("Could not load organization access");
  expect(html).toContain("Retry");
  expect(html).not.toContain("You do not belong to any organizations");
  expect(html).not.toContain("Organization selected");
});

test("unknown membership roles do not claim privileges", () => {
  expect(describeOrganizationAccess("5_UNKNOWN").label).toBe("Unknown role");
});
function Probe({ id = "selected" }: { id?: string }) {
  const access = useOrganizationCapabilities(id);
  return <output>{JSON.stringify({ state: access.state, create: access.canCreateProject, manage: access.canManageUsers, label: access.organization?.name })}</output>;
}
function probe(id?: string) {
  const html = render(<Probe id={id} />);
  return JSON.parse(html.replace(/<[^>]*>/g, "").replaceAll("&quot;", '"'));
}

test("owning A never exposes creation or management controls for B", () => {
  seed([membership("_4_OWNER", "A"), membership("_1_VIEWER", "B")]);
  expect(probe("A").manage).toBe(true);
  expect(probe("B")).toMatchObject({ state: "ready", create: false, manage: false });
  expect(probe("C")).toMatchObject({ state: "denied", create: false, manage: false });
});

test("loading membership data never exposes privileged actions", () => {
  expect(probe()).toMatchObject({ state: "loading", create: false, manage: false });
});

test("administrator gets known-ID capabilities and fallback label with empty memberships", () => {
  useAuthStore.setState({ user: admin });
  seed([]);
  expect(probe()).toEqual({ state: "ready", create: true, manage: true, label: "selected" });
});

test("metadata failure does not revoke administrator known-ID access", async () => {
  useAuthStore.setState({ user: admin });
  const { queryClient, sessionId } = useAuthStore.getState();
  await queryClient.fetchQuery(privateQueryKey(sessionId, "organizations", "my"), () => Promise.reject(new ApiError(500, "Server unavailable")), { retry: false }).catch(() => {});
  expect(probe()).toMatchObject({ state: "ready", create: true, manage: true, label: "selected" });
});

test("failed background membership verification hides cached privileges and offers Retry", async () => {
  seed([membership("_4_OWNER")]);
  const { queryClient, sessionId } = useAuthStore.getState();
  await queryClient.fetchQuery(privateQueryKey(sessionId, "organizations", "my"), () => Promise.reject(new ApiError(500, "Server unavailable")), { retry: false }).catch(() => {});
  expect(probe()).toMatchObject({ state: "error", create: false, manage: false });
  const html = render(<AccessFeedback error={new ApiError(500, "Server unavailable")} onRetry={() => {}} />);
  expect(html).toContain("Retry");
  expect(html).not.toContain("Access denied");
});

test("403 refreshes membership data and blocks stale controls until explicit recovery", async () => {
  seed([membership("_4_OWNER")]);
  const { queryClient, sessionId } = useAuthStore.getState();
  let refreshes = 0;
  const observer = new QueryObserver(queryClient, {
    queryKey: privateQueryKey(sessionId, "organizations", "my"),
    queryFn: async () => { refreshes++; return [membership("_1_VIEWER")]; },
    staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => {});
  reportOrganizationDenial(queryClient, sessionId, "selected", new ApiError(403, "Forbidden"));
  expect(probe()).toMatchObject({ state: "denied", create: false, manage: false });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(refreshes).toBe(1);
  expect(queryClient.getQueryData(privateQueryKey(sessionId, "organizations", "my"))).toEqual([membership("_1_VIEWER")]);
  expect(probe().state).toBe("denied");
  const html = render(<AccessFeedback error={new ApiError(403, "Forbidden")} onRetry={() => {}} />);
  expect(html).toContain("Access denied");
  expect(html).toContain("Retry");
  unsubscribe();
});

test("network failures and late denials from another session never poison capabilities", () => {
  seed([membership("_4_OWNER")]);
  const { queryClient, sessionId } = useAuthStore.getState();
  reportOrganizationDenial(queryClient, sessionId, "selected", new ApiError(0, "Offline"));
  expect(probe().manage).toBe(true);
  useAuthStore.getState().clearSession();
  reportOrganizationDenial(queryClient, sessionId, "selected", new ApiError(403, "Old session"));
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});

test("ordinary users cannot reach the administrator route", () => {
  seed([membership("_4_OWNER")]);
  const html = render(<Routes><Route element={<RequireAdministrator />}><Route path="/admin" element={<div>Secret admin function</div>} /></Route></Routes>, "/admin");
  expect(html).toContain("Access denied");
  expect(html).not.toContain("Secret admin function");
});

test("administrator without memberships can reach admin and organization routes", () => {
  useAuthStore.setState({ user: admin });
  seed([]);
  for (const [Guard, path] of [[RequireAdministrator, "/admin"], [RequireOrganizationOwner, "/organizations/selected"]] as const) {
    const html = render(<Routes><Route element={<Guard />}><Route path={path.includes("organizations") ? "/organizations/:organizationId" : path} element={<Outlet />}><Route index element={<div>Authorized content</div>} /></Route></Route></Routes>, path);
    expect(html).toContain("Authorized content");
  }
});

for (const role of ["_1_VIEWER", "_2_ANNOTATOR"]) {
  test(`${role} receives a clear denial on the creation route`, () => {
    seed([membership(role)]);
    const html = render(<Routes><Route element={<RequireProjectCreator />}><Route path="/projects/create" element={<div>Project creation form</div>} /></Route></Routes>, "/projects/create");
    expect(html).toContain("Access denied");
    expect(html).not.toContain("Project creation form");
  });
}

test("creation guard checks the selected organization rather than another editable organization", () => {
  seed([membership("_4_OWNER", "A"), membership("_1_VIEWER", "B")]);
  const routes = <Routes><Route element={<RequireProjectCreator />}><Route path="/projects/create" element={<div>Project creation form</div>} /></Route></Routes>;
  expect(render(routes, "/projects/create?organizationId=B")).toContain("Access denied");
  expect(render(routes, "/projects/create?organizationId=A")).toContain("Project creation form");
});

test("administrator can reach the known-ID creation route without memberships", () => {
  useAuthStore.setState({ user: admin });
  seed([]);
  const html = render(<Routes><Route element={<RequireProjectCreator />}><Route path="/projects/create" element={<div>Project creation form</div>} /></Route></Routes>, "/projects/create?organizationId=selected");
  expect(html).toContain("Project creation form");
});

test("background permission checks suppress previously cached controls while pending", async () => {
  seed([membership("4_OWNER")]);
  const { queryClient, sessionId } = useAuthStore.getState();
  let resolve!: (data: OrganizationMembership[]) => void;
  const pending = queryClient.fetchQuery(privateQueryKey(sessionId, "organizations", "my"), () => new Promise<OrganizationMembership[]>((accept) => { resolve = accept; }));
  expect(probe()).toMatchObject({ state: "loading", create: false, manage: false });
  resolve([membership("1_VIEWER")]);
  await pending;
  expect(probe()).toMatchObject({ state: "ready", create: false, manage: false });
});

test("a successful explicit retry clears a denial and uses the refreshed role", async () => {
  seed([membership("4_OWNER")]);
  const { queryClient, sessionId } = useAuthStore.getState();
  reportOrganizationDenial(queryClient, sessionId, "selected", new ApiError(403, "Forbidden"));
  let retry!: () => Promise<void>;
  // eslint-disable-next-line react-hooks/globals -- Capture a callback from a one-off server render for this test.
  function Recovery() { retry = useOrganizationCapabilities("selected").retry; return null; }
  render(<Recovery />);
  const request = spyOn(api.organizations, "getMy").mockResolvedValue([membership("1_VIEWER")]);
  try {
    await retry();
    expect(probe()).toMatchObject({ state: "ready", create: false, manage: false });
  } finally { request.mockRestore(); }
});

// Map rendering is unrelated to access. Keep these page regressions independent of browser-only Leaflet.
mock.module("../src/components/Map", () => ({ Map: () => <div>Project map</div> }));
mock.module("leaflet", () => ({}));
mock.module("../src/geo/projections", () => ({ planarToLatLng: () => null, polygonAreaM2: () => 0 }));

const project = { id: "known-project", organizationId: "selected", name: "Authorized project", topLeft: { latitude: 51, longitude: 17 }, bottomRight: { latitude: 50.99, longitude: 17.01 } };

test("authorized project page renders for administrator with empty memberships", async () => {
  useAuthStore.setState({ user: admin });
  seed([]);
  const { queryClient, sessionId } = useAuthStore.getState();
  const request = spyOn(api.projects, "findById").mockResolvedValue(project);
  try {
    await queryClient.fetchQuery(privateQueryKey(sessionId, "project", "selected", "known-project"), () => api.projects.findById("selected", "known-project"));
    const { default: ProjectPage } = await import("../src/pages/projects/ProjectPage");
    const html = render(<Routes><Route path="/projects/:organizationId/:projectId" element={<ProjectPage />} /></Routes>, "/projects/selected/known-project");
    expect(html).toContain("Authorized project");
    expect(html).toContain("selected");
    expect(html).toContain("Danger zone");
    expect(html).not.toContain("Access denied");
  } finally { request.mockRestore(); }
});

test("optional metadata failure cannot replace an authorized administrator project with an error", async () => {
  useAuthStore.setState({ user: admin });
  const { queryClient, sessionId } = useAuthStore.getState();
  await queryClient.fetchQuery(privateQueryKey(sessionId, "organizations", "my"), () => Promise.reject(new ApiError(500, "Metadata failure")), { retry: false }).catch(() => {});
  queryClient.setQueryData(privateQueryKey(sessionId, "project", "selected", "known-project"), project);
  const { default: ProjectPage } = await import("../src/pages/projects/ProjectPage");
  const html = render(<Routes><Route path="/projects/:organizationId/:projectId" element={<ProjectPage />} /></Routes>, "/projects/selected/known-project");
  expect(html).toContain("Authorized project");
  expect(html).toContain("Danger zone");
  expect(html).not.toContain("Access denied");
});

test("viewer project list has no New project action", async () => {
  seed([membership("1_VIEWER")]);
  const { queryClient, sessionId } = useAuthStore.getState();
  queryClient.setQueryData(privateQueryKey(sessionId, "projects", undefined, ["selected"]), [{ organization: { id: "selected", name: "Selected organization" }, projects: [project] }]);
  const { default: ProjectsPage } = await import("../src/pages/projects/ProjectsPage");
  const html = render(<ProjectsPage />, "/projects");
  expect(html).toContain("Authorized project");
  expect(html).not.toContain("New project");
});
