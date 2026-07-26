import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../manifest.json", import.meta.url), "utf8"),
);

test("manifest declares APIs used by the service worker", () => {
  assert.equal(manifest.permissions.includes("alarms"), true);
  assert.equal(manifest.permissions.includes("tabs"), false);
  assert.equal(manifest.background.type, "module");
});

test("manifest exposes only the redirect page to websites", () => {
  assert.deepEqual(manifest.web_accessible_resources, [
    {
      resources: ["blocked.html"],
      matches: ["http://*/*", "https://*/*"],
    },
  ]);
});

test("manifest does not register the obsolete static ruleset", () => {
  assert.equal("declarative_net_request" in manifest, false);
});
