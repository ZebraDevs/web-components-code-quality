import { exec } from "@actions/exec";
import { setFailed } from "@actions/core";
import { stepResponse, failedEmoji, passedEmoji } from "src/main";

export const formatting = async (): Promise<stepResponse> => {
  try {
    // Run prettier
    await exec("npm run prettier");

    return { output: `${passedEmoji} - Formatting`, error: false };
  } catch (error) {
    if (error instanceof Error) setFailed(error.message);
    return { output: `${failedEmoji} - Formatting`, error: true };
  }
};
