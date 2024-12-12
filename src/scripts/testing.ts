import { setFailed } from "@actions/core";
import { stepResponse, buildComment } from "src/main";

export const testing = async (): Promise<stepResponse> => {
  const commands = [
    { label: "Testing", command: "npm run test -- --coverage" },
    { label: "TSDoc", command: "npm run docs" },
  ];

  let [commentBody, errorMessages] = await buildComment(commands);

  if (errorMessages) {
    setFailed(errorMessages.trim());
    return { output: commentBody.trim(), error: true };
  } else {
    return { output: commentBody.trim(), error: false };
  }
};
