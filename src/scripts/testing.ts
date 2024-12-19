import { setFailed } from "@actions/core";
import {
  buildComment,
  Command,
  commandComment,
  runBashCommand,
  runCommand,
  StepResponse,
} from "src/main";
// import { exec } from "@actions/exec";

export const playwright = async (command: Command): Promise<StepResponse> => {
  await runBashCommand(
    "npm ls @playwright/test | grep @playwright | sed 's/.*@//'",
  )
    .then((version) => {
      process.env.PLAYWRIGHT_VERSION = version.trim();
    })
    .catch((error) => {
      setFailed(`Failed to get Playwright version: ${error as string}`);
      return { output: error.message as string, error: true };
    });

  return await commandComment(command);
};

/// TODO: format this comment
export const testing = async (command: Command): Promise<StepResponse> => {
  const [response, outputStr] = await runCommand(command);
  return await buildComment(response, outputStr, command.label);

  // const commands = [
  //   // { label: "Testing", command: "npm run test -- --coverage" },
  //   {
  //     label: "Install PlayWright Browsers",
  //     command: "npx playwright install --with-deps",
  //   },
  //   { label: "Testing", command: "npm run test -- --coverage" },
  //   { label: "TSDoc", command: "npm run docs" },
  // ];

  // const [commentBody, errorMessages] = await buildComment(commands);

  // if (errorMessages) {
  //   setFailed(errorMessages.trim());
  //   return { output: commentBody.trim(), error: true };
  // } else {
  //   return { output: commentBody.trim(), error: false };
  // }
};
