import test from "node:test";
import assert from "node:assert/strict";

import { createOperationQueue } from "../src/core/operationQueue.js";

test("operation queue serializes overlapping mutations", async () => {
  const queue = createOperationQueue();
  const events = [];
  let activeOperations = 0;
  let maximumConcurrency = 0;
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = queue.run(async () => {
    activeOperations += 1;
    maximumConcurrency = Math.max(maximumConcurrency, activeOperations);
    events.push("first:start");
    await firstGate;
    events.push("first:end");
    activeOperations -= 1;
  });

  const second = queue.run(async () => {
    activeOperations += 1;
    maximumConcurrency = Math.max(maximumConcurrency, activeOperations);
    events.push("second:start");
    activeOperations -= 1;
  });

  await new Promise((resolve) => queueMicrotask(resolve));
  assert.deepEqual(events, ["first:start"]);
  releaseFirst();
  await Promise.all([first, second]);

  assert.equal(maximumConcurrency, 1);
  assert.deepEqual(events, ["first:start", "first:end", "second:start"]);
});

test("operation queue continues after a failed mutation", async () => {
  const queue = createOperationQueue();
  await assert.rejects(queue.run(() => Promise.reject(new Error("failed"))));
  assert.equal(await queue.run(() => "recovered"), "recovered");
});
