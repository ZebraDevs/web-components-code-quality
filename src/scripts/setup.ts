import { setFailed } from "@actions/core";
import { stepResponse, buildComment } from "src/main";

export const setup = async (): Promise<stepResponse> => {
  const commands = [{ label: "Install Dependencies", command: "npm ci" }];

  const [commentBody, errorMessages] = await buildComment(commands);

  if (errorMessages) {
    setFailed(errorMessages.trim());
    return { output: commentBody.trim(), error: true };
  } else {
    return { output: commentBody.trim(), error: false };
  }
};
