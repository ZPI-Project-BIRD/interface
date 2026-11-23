import { afterAll, beforeAll, beforeEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import configure from "../vite.config";

const projectRoot = new URL("../", import.meta.url).pathname;
const cleanEnvDirectory = mkdtempSync(join(tmpdir(), "bird-api-config-"));
const requests: { method?: string; url?: string; headers: IncomingHttpHeaders; body: string }[] = [];
const csrf = { headerName: "X-XSRF-TOKEN", token: "configuration-test-token" };
let frontend: ViteDevServer | undefined;
let frontendOrigin: string;

function configWithTarget(target?: string) {
  const previousDirectory = process.cwd();
  const previousTarget = process.env.API_PROXY_TARGET;
  try {
    process.chdir(cleanEnvDirectory);
    if (target === undefined) delete process.env.API_PROXY_TARGET;
    else process.env.API_PROXY_TARGET = target;
    return configure({ command: "serve", mode: "test" });
  } finally {
    process.chdir(previousDirectory);
    if (previousTarget === undefined) delete process.env.API_PROXY_TARGET;
    else process.env.API_PROXY_TARGET = previousTarget;
  }
}

const backend = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    requests.push({ method: request.method, url: request.url, headers: request.headers, body });
    response.setHeader("Content-Type", "application/json");

    if (request.url === "/api/auth/csrf") {
      response.setHeader("Set-Cookie", `XSRF-TOKEN=${csrf.token}; Path=/; SameSite=Lax`);
      response.end(JSON.stringify(csrf));
    } else if (request.url === "/api/auth/login" && request.method === "POST") {
      if (request.headers[csrf.headerName.toLowerCase()] !== csrf.token) {
        response.writeHead(403).end(JSON.stringify({ message: "Missing CSRF header" }));
        return;
      }
      response.setHeader("Set-Cookie", "SESSION=configuration-test; Path=/; HttpOnly; SameSite=Lax");
      response.end(JSON.stringify({ username: "configuration-test", authorities: [] }));
    } else {
      response.writeHead(404).end(JSON.stringify({ message: "Backend route not found" }));
    }
  });
});

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    backend.once("error", reject);
    backend.listen(0, "127.0.0.1", resolve);
  });
  const upstream = `http://127.0.0.1:${(backend.address() as AddressInfo).port}`;
  const config = configWithTarget(upstream);
  frontend = await createViteServer({
    ...config,
    root: projectRoot,
    configFile: false,
    envFile: false,
    logLevel: "silent",
    server: { ...config.server, host: "127.0.0.1", port: 0, strictPort: false },
  });
  await frontend.listen();
  frontendOrigin = `http://127.0.0.1:${(frontend.httpServer!.address() as AddressInfo).port}`;
}, 20_000);

beforeEach(() => { requests.length = 0; });

afterAll(async () => {
  await frontend?.close();
  if (backend.listening) {
    backend.closeAllConnections();
    await new Promise<void>((resolve) => backend.close(() => resolve()));
  }
  rmSync(cleanEnvDirectory, { recursive: true, force: true });
});

test("a checkout without env files uses the local backend and a stable frontend origin", () => {
  const config = configWithTarget();
  expect(config.server.port).toBe(5173);
  expect(config.server.strictPort).toBe(true);
  expect(config.server.proxy["/api"]).toEqual({
    target: "http://localhost:8080",
    changeOrigin: true,
  });
});

test("the proxy target can be overridden without rewriting the API prefix", () => {
  const config = configWithTarget(" http://127.0.0.1:9090 ");
  expect(config.server.proxy["/api"].target).toBe("http://127.0.0.1:9090");
  expect(config.server.proxy["/api"]).not.toHaveProperty("rewrite");
});

test("CSRF requests and cookie headers pass through the proxy", async () => {
  const response = await fetch(`${frontendOrigin}/api/auth/csrf`, {
    headers: { Cookie: "SESSION=configuration-test" },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toEqual(csrf);
  expect(response.headers.get("set-cookie")).toContain(`XSRF-TOKEN=${csrf.token}`);
  expect(requests[0].url).toBe("/api/auth/csrf");
  expect(requests[0].headers.cookie).toBe("SESSION=configuration-test");
});

test("the real API client defaults a blank URL to /api and fetches CSRF before login", async () => {
  const previousApiUrl = process.env.VITE_API_URL;
  const nativeFetch = globalThis.fetch;
  const credentialsModes: (RequestCredentials | undefined)[] = [];
  process.env.VITE_API_URL = "   ";
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((input, options) => {
    credentialsModes.push(options?.credentials);
    const url = typeof input === "string" && input.startsWith("/")
      ? new URL(input, frontendOrigin)
      : input;
    return nativeFetch(url, options);
  });

  try {
    const { api } = await import("../src/api");
    expect(await api.auth.login({ username: "configuration-test", password: "not-a-real-password" }))
      .toEqual({ username: "configuration-test", authorities: [] });
    expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      "GET /api/auth/csrf",
      "POST /api/auth/login",
    ]);
    expect(requests[1].headers[csrf.headerName.toLowerCase()]).toBe(csrf.token);
    expect(JSON.parse(requests[1].body)).toEqual({
      username: "configuration-test", password: "not-a-real-password",
    });
    expect(credentialsModes).toEqual(["include", "include"]);
  } finally {
    fetchSpy.mockRestore();
    if (previousApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = previousApiUrl;
  }
});

test("login response session cookies are preserved", async () => {
  const response = await fetch(`${frontendOrigin}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", [csrf.headerName]: csrf.token },
    body: JSON.stringify({ username: "configuration-test", password: "not-a-real-password" }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("SESSION=configuration-test;");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
});

test("backend errors do not fall through to the SPA HTML", async () => {
  const response = await fetch(`${frontendOrigin}/api/does-not-exist`, {
    headers: { Accept: "text/html" },
  });
  expect(response.status).toBe(404);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toEqual({ message: "Backend route not found" });
});

test("a project deep link serves the application document in development", async () => {
  const response = await fetch(`${frontendOrigin}/projects/configuration-test`, {
    headers: { Accept: "text/html" },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/html");
  expect(await response.text()).toContain('<div id="root"></div>');
  expect(requests).toHaveLength(0);
});
