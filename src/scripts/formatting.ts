import { exec } from "@actions/exec";
import { setFailed } from "@actions/core";
import { stepResponse } from "src/main";

export const formatting = async (): Promise<stepResponse> => {
  try {
    // Run prettier
    await exec("npm run prettier");

    return { output: "Formatting complete", error: false };
  } catch (error) {
    if (error instanceof Error) setFailed(error.message);
    return { output: "Formatting failed", error: true };
  }
};
