import { setFailed } from "@actions/core";
import { stepResponse, failedEmoji, passedEmoji, runCommand } from "src/main";

export const analyze = async (): Promise<stepResponse> => {
  const results = [
    { label: "Custom Elements Manifest Analyzer", command: "npm run analyze" },
    { label: "ESLint", command: "npm run lint" },
    { label: "Lit Analyzer", command: "npm run lint:lit-analyzer" },
  ];

  let commentBody = "\n";
  let errorMessages = "";

  for (const { label, command } of results) {
    const result = await runCommand(command, label);
    if (result) {
      commentBody += `${failedEmoji} <details><summary>${label}</summary>${result}</details>\n`;
      errorMessages += `${result}\n`;
    } else {
      commentBody += `${passedEmoji} - ${label}\n`;
    }
  }

  if (errorMessages) {
    setFailed(errorMessages.trim());
    return { output: commentBody.trim(), error: true };
  } else {
    return { output: commentBody.trim(), error: false };
  }
};
