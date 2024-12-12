import { setFailed } from "@actions/core";
import { stepResponse, buildComment } from "src/main";

export const analyze = async (): Promise<stepResponse> => {
  const commands = [
    { label: "Custom Elements Manifest Analyzer", command: "npm run analyze" },
    { label: "ESLint", command: "npm run lint" },
    { label: "Lit Analyzer", command: "npm run lint:lit-analyzer" },
  ];

  const [commentBody, errorMessages] = await buildComment(commands);

  if (errorMessages) {
    setFailed(errorMessages.trim());
    return { output: commentBody.trim(), error: true };
  } else {
    return { output: commentBody.trim(), error: false };
  }
};
