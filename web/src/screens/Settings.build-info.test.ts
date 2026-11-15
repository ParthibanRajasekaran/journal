import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ServerVersion } from "../api";
import { BuildInfo } from "./Settings";

const server: ServerVersion = {
  api_version: "1.0.0-draft",
  source_sha: "0123456789abcdef0123",
  migration_head: "a7c3e9d2b104",
  environment: "production",
};

function render(props: { appSha?: string; server: ServerVersion | null; failed: boolean }) {
  return renderToStaticMarkup(createElement(BuildInfo, props));
}

afterEach(() => vi.unstubAllGlobals());

describe("Settings build info", () => {
  it("shows the app build and the server version", () => {
    const html = render({ appSha: "fedcba9876543210", server, failed: false });
    expect(html).toContain("fedcba987654");
    expect(html).toContain("0123456789ab");
    expect(html).toContain("production");
    expect(html).toContain("migration a7c3e9d2b104");
  });

  it("says so when the app is a development build", () => {
    expect(render({ server, failed: false })).toContain("development build");
  });

  it("does not invent server details when the server cannot be reached", () => {
    const html = render({ appSha: "fedcba9876543210", server: null, failed: true });
    expect(html).toContain("Can&#x27;t reach the server.");
    expect(html).not.toContain("production");
  });

  it("reads the server version from GET /version without a body", async () => {
    const spy = vi.fn().mockResolvedValue(new Response(JSON.stringify(server), { status: 200 }));
    vi.stubGlobal("fetch", spy);
    expect(await api.version()).toEqual(server);
    expect(spy.mock.calls[0][0]).toMatch(/\/api\/v1\/version$/);
    expect(spy.mock.calls[0][1].method).toBe("GET");
  });
});
