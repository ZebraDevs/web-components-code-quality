/**
 * Unit tests for the action's entrypoint, src/index.ts
 */

import * as main from "../src/main";

// Mock the action's entrypoint
const runMock = jest
  .spyOn(main as { run: () => void }, "run")
  .mockImplementation();

describe("index", () => {
  it("calls run when imported", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-call
    await import("../src/index");

    expect(runMock).toHaveBeenCalled();
  });
});
