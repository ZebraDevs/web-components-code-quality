import { setFailed } from "@actions/core";
import { stepResponse, buildComment } from "src/main";
import { exec } from "@actions/exec";

export const testing = async (): Promise<stepResponse> => {
  const runCommand = async (command: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      exec(command, [], {
        listeners: {
          stdout: (data: Buffer) => {
            resolve(data.toString());
          },
          stderr: (data: Buffer) => {
            reject(new Error(data.toString()));
          },
        },
      }).catch((error: Error) => {
        reject(error);
      });
    });
  };

  await runCommand("npm ls @playwright/test | grep @playwright | sed 's/.*@//'")
    .then((version) => {
      process.env.PLAYWRIGHT_VERSION = version.trim();
    })
    .catch((error) => {
      setFailed(`Failed to get Playwright version: ${error}`);
      return { output: "", error: true };
    });

  const commands = [
    // { label: "Testing", command: "npm run test -- --coverage" },
    {
      label: "Install PlayWright Browsers",
      command: "npx playwright install --with-deps",
    },
    { label: "Testing", command: "npm run test" },
    { label: "TSDoc", command: "npm run docs" },
  ];

  const [commentBody, errorMessages] = await buildComment(commands);

  if (errorMessages) {
    setFailed(errorMessages.trim());
    return { output: commentBody.trim(), error: true };
  } else {
    return { output: commentBody.trim(), error: false };
  }
};
