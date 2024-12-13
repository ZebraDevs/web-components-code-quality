import { getBooleanInput, getInput, setFailed, debug } from "@actions/core";
import { exec } from "@actions/exec";
import { getOctokit, context } from "@actions/github";
import { analyze } from "./scripts/analyze";
import { formatting } from "./scripts/formatting";
import { testing } from "./scripts/testing";
import { comment } from "./scripts/comment";
import { cwd, chdir } from "process";
// import { coverage } from './scripts/coverage'
import minimist from "minimist";
import { setup } from "./scripts/setup";

export type Command = { label: string; command: string };

export type stepResponse = { output: string; error: boolean };
export const failedEmoji = "❌";
export const passedEmoji = "✅";

export const buildComment = async (
  commands: { label: string; command: string }[],
): Promise<string[]> => {
  let commentBody = "\n";
  let errorMessages = "";
  for (const { label, command } of commands) {
    const result = await runCommand(command, label);
    if (result) {
      commentBody += `<li>${failedEmoji} - ${label}
<details><summary>See details</summary>${result}</details></li>`;
      errorMessages += `${result}`;
    } else {
      commentBody += `<li>${passedEmoji} - ${label}\n</li>`;
    }
  }
  return [commentBody, errorMessages];
};

export const runCommand = async (
  command: string,
  label: string,
): Promise<string | boolean> => {
  let output = "";
  try {
    await exec(command, [], {
      listeners: {
        stdout: (data) => {
          output += data.toString();
        },
      },
    });
    return false;
  } catch (error: unknown) {
    if (error instanceof Error) {
      debug(`${label} failed: ${error.message}`);
      return output;
    } else if (typeof error === "string") {
      debug(`${label} failed: ${error}`);
      return output;
    } else {
      return true;
    }
  }
};

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  const argv = minimist(process.argv.slice(2));

  const isLocal =
    argv._.findLast((x: string) => x == "--local") == "--local" ? true : false;

  try {
    const workingDirectory = getInput("working-directory");
    // Check if the working directory is different from the current directory
    const currentDirectory = cwd();
    if (workingDirectory && workingDirectory !== currentDirectory) {
      chdir(workingDirectory);
    }

    // get the token and octokit
    let token = "";
    if (process.env.GITHUB_TOKEN && isLocal) {
      token = process.env.GITHUB_TOKEN;
    } else {
      token = getInput("token");
    }
    const octokit = getOctokit(token);

    // get static analysis input
    const doStaticAnalysis: boolean = isLocal
      ? true
      : getBooleanInput("run-static-analysis");

    // get code formatting input
    const doCodeFormatting: boolean = isLocal
      ? true
      : getBooleanInput("run-code-formatting");

    // get tests input
    const doTests: boolean = isLocal ? true : getBooleanInput("run-tests");

    // const runCoverage: boolean = getBooleanInput('run-coverage');
    // const coveragePassScore: string = getInput('coverage-pass-score');
    // get comment input
    const createComment: boolean = isLocal
      ? true
      : getBooleanInput("create-comment");

    // run set up
    const setupStr: stepResponse | undefined = await setup();

    // run Static Analysis
    const analyzeStr: stepResponse | undefined = doStaticAnalysis
      ? await analyze()
      : undefined;

    const eslintStr: stepResponse | undefined = doStaticAnalysis
      ? await eslint({ label: "ESLint", command: "npm run lint" })
      : undefined;

    // run Code Formatting
    const codeFormattingStr: stepResponse | undefined = doCodeFormatting
      ? await formatting()
      : undefined;

    // run Tests
    const testingStr: stepResponse | undefined = doTests
      ? await testing()
      : undefined;

    // runCoverage
    // const coverageStr: stepResponse | undefined = runCoverage
    //   ? await coverage()
    //   : undefined

    // createComment
    if (createComment) {
      await comment(
        octokit,
        context,
        setupStr,
        analyzeStr,
        eslintStr,
        codeFormattingStr,
        testingStr,
      );
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) setFailed(error.message);
  }
}

const eslint = async (command: Command): Promise<stepResponse> => {
  let response: stepResponse = { output: "", error: false };
  let outputStr = "";
  let error = false;
  try {
    await exec(command.command, [], {
      listeners: {
        stdout: (data) => {
          outputStr += data.toString();
        },
      },
    });
  } catch (error) {
    error = true;
    setFailed(`Failed ${command.label}: ${error}`);
  }

  const lines = outputStr.split("\n");
  const table = lines
    .map((line) => {
      const match = line.match(/^(.*?):(\d+):(\d+): (.*)$/);
      if (match) {
        const [_, file, line, column, message] = match;
        return `<tr><td>${file}</td><td>${line}</td><td>${column}</td><td>${message}</td></tr>`;
      }
      return "";
    })
    .join("");

  const problemCount = lines.filter((line) =>
    line.match(/^(.*?):(\d+):(\d+): (.*)$/),
  ).length;

  if (problemCount > 0) {
    response.error = true;
    response.output = `<li>${failedEmoji} - ${command.label}: ${problemCount} problem${problemCount !== 1 ? "s" : ""} found\n<details><summary>See Details</summary><table><tr><th>File</th><th>Line</th><th>Column</th><th>Message</th></tr>${table}</table></details></li>`;
  } else {
    response.output = `<li>${passedEmoji} - ${command.label}\n</li>`;
  }
  return response;
};
