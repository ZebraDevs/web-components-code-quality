import { getBooleanInput, getInput, setFailed, debug } from "@actions/core";
import { exec } from "@actions/exec";
import { getOctokit, context } from "@actions/github";
import { eslint, litAnalyzer } from "./scripts/analyze";
import { playwright, testing } from "./scripts/testing";
import { comment } from "./scripts/comment";
import { cwd, chdir } from "process";
// import { coverage } from './scripts/coverage'
import minimist from "minimist";
import { execSync } from "child_process";
import { checkModifiedFiles, updateChanges } from "./scripts/post";

export type Command = {
  label: string;
  command: string;
  commandList?: string[];
};

export type StepResponse = { output: string; error: boolean };
export const failedEmoji = "❌";
export const passedEmoji = "✅";

export const runBashCommand = async (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const output = execSync(command, { encoding: "utf-8" });
      resolve(output);
    } catch (error) {
      reject(error);
    }
  });
};

export const runCommand = async (
  command: Command,
): Promise<[StepResponse, string]> => {
  let response: StepResponse = { output: "", error: false };
  let outputStr = "";
  try {
    await exec(command.command, [], {
      listeners: {
        stdout: (data) => {
          outputStr += data.toString();
        },
      },
    });
  } catch (error) {
    response.error = true;
    setFailed(`Failed ${command.label}: ${error as string}`);
  }
  return [response, outputStr];
};

export const buildComment = async (
  response: StepResponse,
  outputStr: string,
  label: string,
): Promise<StepResponse> => {
  if (response.error == true) {
    response.output = `${failedEmoji} - ${label}\n<details><summary>See Details</summary>${outputStr}</details>`;
  } else {
    response.output = `${passedEmoji} - ${label}\n`;
  }
  return response;
};

export const commandComment = async (
  command: Command,
): Promise<StepResponse> => {
  const [response, outputStr] = await runCommand(command);
  return await buildComment(response, outputStr, command.label);
};

const checkIfLocal = (): boolean => {
  const argv = minimist(process.argv.slice(2));

  return argv._.findLast((x: string) => x == "--local") == "--local"
    ? true
    : false;
};

const getInputs = (
  isLocal: boolean,
): [string, string, boolean, boolean, boolean, boolean] => {
  // get the token and octokit
  let token = "";
  if (process.env.GITHUB_TOKEN && isLocal) {
    token = process.env.GITHUB_TOKEN;
  } else {
    token = getInput("token");
  }

  const workingDirectory = getInput("working-directory");

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

  return [
    token,
    workingDirectory,
    doStaticAnalysis,
    doCodeFormatting,
    doTests,
    createComment,
  ];
};

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  const isLocal = checkIfLocal();

  try {
    const [
      token,
      workingDirectory,
      doStaticAnalysis,
      doCodeFormatting,
      doTests,
      createComment,
    ] = getInputs(isLocal);

    // Check if the working directory is different from the current directory
    const currentDirectory = cwd();
    if (workingDirectory && workingDirectory !== currentDirectory) {
      chdir(workingDirectory);
    }

    // run set up
    const npmIStr: StepResponse | undefined = await commandComment({
      label: "Install Dependencies",
      command: "npm i --ignore-scripts",
    });

    // run Static Analysis
    const cemStr: StepResponse | undefined = await commandComment({
      label: "Custom Elements Manifest",
      command: "npm run analyze",
    });

    const eslintStr: StepResponse | undefined = doStaticAnalysis
      ? await eslint({ label: "ESLint", command: "npm run lint" })
      : undefined;

    const litAnalyzerStr: StepResponse | undefined = doStaticAnalysis
      ? await litAnalyzer({
          label: "Lit Analyzer",
          command: "npm run lint:lit-analyzer -- --format markdown",
        })
      : undefined;

    // run Code Formatting
    const prettierStr: StepResponse | undefined = doCodeFormatting
      ? await commandComment({ label: "Prettier", command: "npm run prettier" })
      : undefined;

    const playwrightStr: StepResponse | undefined = doTests
      ? await playwright({
          label: "Install PlayWright Browsers",
          command: "npx playwright install --with-deps",
        })
      : undefined;

    // run Tests
    const testingStr: StepResponse | undefined = doTests
      ? await testing({
          label: "Testing",
          command: "npm run test -- --coverage",
        })
      : undefined;

    const tsDocStr: StepResponse | undefined = doTests
      ? await commandComment({ label: "TSDoc", command: "npm run docs" })
      : undefined;

    const checkModifiedFilesStr: StepResponse | undefined =
      await checkModifiedFiles({
        label: "Check for modified files",
        command:
          'echo "modified=$(if [ -n "$(git status --porcelain)" ]; then echo "true"; else echo "false"; fi)" >> $GITHUB_ENV',
      });

    const updateChangesStr: StepResponse | undefined = await updateChanges({
      label: "Update changes in GitHub repository",
      command: "",
      commandList: [
        'git config --global user.name "github-actions"',
        'git config --global user.email "github-actions@github.com"',
        "git add -A",
        'git commit -m "[automated commit] lint format and import sort"',
        "git brokenSTRING push",
        // "git push",
      ],
    });

    // runCoverage
    // const coverageStr: StepResponse | undefined = runCoverage
    //   ? await coverage()
    //   : undefined

    // createComment
    if (createComment) {
      await comment(
        getOctokit(token),
        context,
        npmIStr,
        cemStr,
        eslintStr,
        litAnalyzerStr,
        prettierStr,
        playwrightStr,
        testingStr,
        tsDocStr,
        checkModifiedFilesStr,
        updateChangesStr,
      );
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) setFailed(error.message);
  }
}
