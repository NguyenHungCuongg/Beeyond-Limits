export function createOperationQueue() {
  let tail = Promise.resolve();

  function run(operation) {
    const next = tail.then(operation, operation);
    tail = next.catch(() => {});
    return next;
  }

  return { run };
}
