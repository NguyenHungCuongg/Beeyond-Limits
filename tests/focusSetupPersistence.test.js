import test from "node:test";
import assert from "node:assert/strict";
import { createFocusSetupPersistence } from "../src/core/focusSetupPersistence.js";

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

test("Focus Setup persistence keeps the newest ambient mix when saves overlap", async () => {
  const firstSave = createDeferred();
  const savedSoundIds = [];
  let saveCount = 0;
  const persistence = createFocusSetupPersistence(async (config) => {
    saveCount += 1;
    savedSoundIds.push(config.ambientSound.soundId);
    if (saveCount === 1) {
      await firstSave.promise;
    }
  });

  persistence.save({ ambientSound: { soundId: "ocean_waves" } });
  persistence.save({ ambientSound: { soundId: "bird" } });
  persistence.save({ ambientSound: { soundId: "rain" } });

  await Promise.resolve();
  assert.deepEqual(savedSoundIds, ["ocean_waves"]);

  firstSave.resolve();
  await persistence.flush();

  assert.deepEqual(savedSoundIds, ["ocean_waves", "rain"]);
});

test("Focus Setup flush waits until the pending configuration is saved", async () => {
  const saveGate = createDeferred();
  let persisted = false;
  const persistence = createFocusSetupPersistence(async () => {
    await saveGate.promise;
    persisted = true;
  });

  persistence.save({ ambientSound: { soundId: "bird" } });
  const flushing = persistence.flush();
  assert.equal(persisted, false);
  saveGate.resolve();
  await flushing;
  assert.equal(persisted, true);
});

test("Focus Setup flush keeps reporting a failed save until a newer config succeeds", async () => {
  let shouldFail = true;
  const persistence = createFocusSetupPersistence(async () => {
    if (shouldFail) {
      throw new Error("Storage unavailable");
    }
  });

  await assert.rejects(
    persistence.save({ ambientSound: { soundId: "ocean_waves" } }),
    /Storage unavailable/,
  );
  await assert.rejects(persistence.flush(), /Storage unavailable/);

  shouldFail = false;
  await persistence.save({ ambientSound: { soundId: "rain" } });
  await assert.doesNotReject(persistence.flush());
});
