import { setFailed } from "@actions/core";
import { stepResponse, failedEmoji, passedEmoji, runCommand } from "src/main";

export const testing = async (): Promise<stepResponse> => {
  const results = [
    { label: "Testing", command: "npm run test -- --coverage" },
    { label: "TSDoc", command: "npm run docs" },
  ];

  let commentBody = "\n";
  let errorMessages = "";

  for (const { label, command } of results) {
    const result = await runCommand(command, label);
    if (result) {
      commentBody += `<li>${failedEmoji} - ${label}</li>`;
      errorMessages += `${result}\n`;
    } else {
      commentBody += `<li>${passedEmoji} - ${label}</li>`;
    }
  }

  if (errorMessages) {
    setFailed(errorMessages.trim());
    return { output: commentBody.trim(), error: true };
  } else {
    return { output: commentBody.trim(), error: false };
  }
};
