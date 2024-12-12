import { setFailed } from "@actions/core";
import { stepResponse, buildComment } from "src/main";

export const formatting = async (): Promise<stepResponse> => {
  const commands = [{ label: "Prettier", command: "npm run prettier" }];

  let [commentBody, errorMessages] = await buildComment(commands);

  if (errorMessages) {
    setFailed(errorMessages.trim());
    return { output: commentBody.trim(), error: true };
  } else {
    return { output: commentBody.trim(), error: false };
  }
};
