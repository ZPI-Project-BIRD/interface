import type { QueryClient } from "react-query";
import { api, ApiError, type CreateProjectPayload, type Project } from "../api";
import type { RectangleBounds } from "../components/Map";
import { privateQueryKey } from "../queryClient";
import { isCurrentSession, withSession } from "../stores/authStore";
import { cacheAcceptedProject, cacheOrganizationProjects } from "./projectCache";

export interface ProjectSubmission {
  organizationId: string;
  name: string;
  rectangle: RectangleBounds;
  payload: CreateProjectPayload;
  baselineProjectIds?: string[];
}
export interface CreationState {
  submission: ProjectSubmission;
  outcome: "pending" | "unknown" | "not-submitted" | "rejected" | "accepted" | "acknowledged";
  phase?: "checking" | "sending";
  error?: string;
  project?: Project;
  candidates?: Project[];
  checked?: boolean;
  checking?: boolean;
  checkError?: string;
}
export const creationKey = (sessionId: number) => privateQueryKey(sessionId, "project-creation");

/** A matching project is a candidate, never proof that this request created it. */
export function matchesSubmission(project: Project, submission: ProjectSubmission) {
  const close = (left: number, right: number) => Math.abs(left - right) < 1e-9;
  return project.organizationId === submission.organizationId && project.name.trim() === submission.name &&
    close(project.topLeft.latitude, submission.payload.topLeft.latitude) &&
    close(project.topLeft.longitude, submission.payload.topLeft.longitude) &&
    close(project.bottomRight.latitude, submission.payload.bottomRight.latitude) &&
    close(project.bottomRight.longitude, submission.payload.bottomRight.longitude);
}

/** Shared across page remounts in one session. The existing API provides no idempotency or discovery retry. */
export class ProjectCreationFlow {
  private inFlight: Promise<Project | undefined> | undefined;
  private checkInFlight: Promise<void> | undefined;
  private client: QueryClient;
  private sessionId: number;
  constructor(client: QueryClient, sessionId: number) { this.client = client; this.sessionId = sessionId; }
  get state() { return this.client.getQueryData<CreationState | null>(creationKey(this.sessionId)); }
  get locked() { return this.state?.outcome === "pending" || this.state?.outcome === "unknown" || Boolean(this.checkInFlight); }

  submit(values: { organizationId: string; name: string; rectangle: RectangleBounds }) {
    if (!isCurrentSession(this.sessionId)) return Promise.resolve(undefined);
    if (this.inFlight) return this.inFlight;
    if (this.locked) return Promise.resolve(undefined);
    let submission: ProjectSubmission = {
      ...structuredClone(values), name: values.name.trim(),
      payload: { name: values.name.trim(), topLeft: { latitude: values.rectangle.north, longitude: values.rectangle.west }, bottomRight: { latitude: values.rectangle.south, longitude: values.rectangle.east } },
    };
    let postStarted = false;
    this.client.setQueryData<CreationState>(creationKey(this.sessionId), { submission, outcome: "pending", phase: "checking" });
    this.inFlight = withSession(this.sessionId, async () => {
      // A failed preflight never sends POST. Existing IDs help distinguish later candidates from older identical projects.
      const existing = await api.projects.getAll(submission.organizationId, { signal: AbortSignal.timeout(15_000) });
      if (!isCurrentSession(this.sessionId)) return undefined;
      submission = { ...submission, baselineProjectIds: existing.map(({ id }) => id) };
      this.client.setQueryData<CreationState>(creationKey(this.sessionId), { submission, outcome: "pending", phase: "sending" });
      postStarted = true;
      return api.projects.create(submission.organizationId, submission.payload);
    }).then((project) => {
      if (!isCurrentSession(this.sessionId) || !project) return undefined;
      cacheAcceptedProject(this.client, this.sessionId, project);
      this.client.setQueryData<CreationState>(creationKey(this.sessionId), { submission, outcome: "accepted", project });
      return project;
    }).catch((error: unknown) => {
      if (!isCurrentSession(this.sessionId)) return undefined;
      const rejected = error instanceof ApiError && [400, 401, 403, 404, 422].includes(error.status);
      this.client.setQueryData<CreationState>(creationKey(this.sessionId), {
        submission, outcome: !postStarted ? "not-submitted" : rejected ? "rejected" : "unknown",
        error: error instanceof Error ? error.message : "No response was received.",
      });
      if (postStarted && !rejected) void this.client.invalidateQueries(privateQueryKey(this.sessionId, "projects"));
      throw error;
    }).finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }

  /** Read-only reconciliation. Never replays POST, and never guesses identity from matching fields. */
  checkExisting() {
    if (!isCurrentSession(this.sessionId)) return Promise.resolve();
    if (this.checkInFlight) return this.checkInFlight;
    const state = this.state;
    if (this.inFlight || !state || !["unknown", "acknowledged"].includes(state.outcome)) return Promise.resolve();
    this.client.setQueryData<CreationState>(creationKey(this.sessionId), { ...state, checking: true, checkError: undefined });
    this.checkInFlight = withSession(this.sessionId, () =>
      api.projects.getAll(state.submission.organizationId, { signal: AbortSignal.timeout(15_000) }),
    ).then((projects) => {
      if (!isCurrentSession(this.sessionId)) return;
      cacheOrganizationProjects(this.client, this.sessionId, state.submission.organizationId, projects);
      const baseline = new Set(state.submission.baselineProjectIds);
      const candidates = projects.filter((project) => !baseline.has(project.id) && matchesSubmission(project, state.submission));
      this.client.setQueryData<CreationState>(creationKey(this.sessionId), { ...state, candidates, checked: true, checking: false, checkError: undefined });
    }).catch((error: unknown) => {
      if (!isCurrentSession(this.sessionId)) return;
      this.client.setQueryData<CreationState>(creationKey(this.sessionId), { ...state, checking: false, checkError: error instanceof Error ? error.message : "Unable to check existing projects." });
      throw error;
    }).finally(() => { this.checkInFlight = undefined; });
    return this.checkInFlight;
  }

  /** Only a deliberate user acknowledgement unlocks a new logical submission after an ambiguous POST. */
  allowAnotherSubmission() {
    if (!isCurrentSession(this.sessionId)) return false;
    const state = this.state;
    if (this.inFlight || this.checkInFlight || state?.outcome !== "unknown" || !state.checked || state.checkError) return false;
    this.client.setQueryData<CreationState>(creationKey(this.sessionId), { ...state, outcome: "acknowledged" });
    return true;
  }
}
const flows = new WeakMap<QueryClient, ProjectCreationFlow>();
export function getProjectCreationFlow(client: QueryClient, sessionId: number) {
  let flow = flows.get(client);
  if (!flow) { flow = new ProjectCreationFlow(client, sessionId); flows.set(client, flow); }
  return flow;
}
