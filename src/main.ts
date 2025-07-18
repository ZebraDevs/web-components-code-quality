import { getBooleanInput, getInput, setFailed } from "@actions/core";
import { exec } from "@actions/exec";
import { getOctokit, context } from "@actions/github";
import { eslint, litAnalyzer, typeDoc } from "./scripts/analyze";
import { playwright, testing } from "./scripts/testing";
import { coverage, getCoverage } from "./scripts/coverage";
import { comment } from "./scripts/comment";
import { cwd, chdir } from "process";
import minimist from "minimist";
import { execSync } from "child_process";
import { checkModifiedFiles, updateChanges } from "./scripts/post";

/**
 * Represents a command with a label and an associated command string.
 * Optionally, it can include a list of related commands.
 *
 * @type {Object} Command
 * @property {string} label - A label for the command.
 * @property {string} command - The command to execute.
 */
export type Command = {
  label: string;
  command: string;
  commandList?: string[];
};

/**
 * Represents the response of a step in a process.
 *
 * @type {Object} StepResponse
 * @property {string} output - The output message of the step.
 * @property {boolean} error - Indicates whether an error occurred during the step.
 */
export type StepResponse = { output: string; error: boolean };

export const failedEmoji = "❌";
export const passedEmoji = "✅";
export const detailsEmoji = "➡️";
export const coverageUp = "📈";
export const coverageDown = "📉";

declare global {
  interface String {
    /**
     * Extends the global String interface to include an `isEmpty` method.
     *
     * The `isEmpty` method checks if the string is empty.
     *
     * @returns {boolean} - Returns `true` if the string is empty, otherwise `false`.
     */
    isEmpty(): boolean;
  }
}

String.prototype.isEmpty = function (): boolean {
  return this == undefined || this == "" || this == null;
};

/**
 * Executes a given Bash command and returns the output as a string.
 *
 * @param command - The Bash command to execute.
 * @returns A promise that resolves with the command's output as a string.
 * @throws An error if the command execution fails.
 */
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

/**
 * Executes a given command asynchronously and returns the response and output string.
 *
 * @param {Command} command - The command to be executed.
 * @returns {Promise<[StepResponse, string]>} A promise that resolves to a tuple containing the response and the output string.
 *
 */
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

/**
 * Builds a comment based on the provided response, label, output string, and problems count.
 *
 * @param {StepResponse} response - The response object containing the error status and output.
 * @param {string} label - A label to be included in the comment.
 * @param {string} outputStr - An optional string to be included in the comment details.
 * @param {number} problemsCount - An optional number representing the count of problems found.
 * @returns {Promise<StepResponse>} A promise that resolves to the updated response object with the constructed comment.
 */
export const buildComment = async (
  response: StepResponse,
  label: string,
  outputStr?: string,
  problemsCount?: number,
): Promise<StepResponse> => {
  if (response.error == true) {
    if (problemsCount !== undefined && problemsCount > 0) {
      response.output = `${failedEmoji} ${label}: ${problemsCount} problem${
        problemsCount > 1 ? "s" : ""
      } found\n<details><summary>&nbsp;${detailsEmoji} See Details</summary>${outputStr}</details>`;
    } else {
      response.output = `${failedEmoji} ${label}\n<details><summary>${detailsEmoji} - See Details</summary>${outputStr}</details>`;
    }
  } else {
    response.output = `${passedEmoji} ${label}\n`;
  }
  return response;
};

/**
 * Executes a given command and builds a comment based on the command's response.
 *
 * @param {Command} command - The command to be executed.
 * @returns {Promise<StepResponse>} A promise that resolves to a StepResponse containing the result of the command execution and the generated comment.
 */
export const commandComment = async (
  command: Command,
): Promise<StepResponse> => {
  const [response, outputStr] = await runCommand(command);
  return await buildComment(response, command.label, outputStr);
};

/**
 * Checks if the "--local" flag is present in the command line arguments.
 *
 * @returns {boolean} - Returns `true` if the "--local" flag is found, otherwise `false`.
 */
const checkIfLocal = (): boolean => {
  const argv = minimist(process.argv.slice(2));

  return argv._.findLast((x: string) => x == "--local") == "--local"
    ? true
    : false;
};

/**
 * Retrieves various inputs required for the application based on the environment.
 *
 * @param {boolean} isLocal - Indicates if the environment is local.
 * @returns {[
 *   string,
 *   string,
 *   string,
 *   string,
 *   boolean,
 *   boolean,
 *   boolean,
 *   string,
 *   boolean,
 *   string,
 *   string,
 *   boolean
 * ]} An array containing the following inputs:
 * - token: The GitHub token.
 * - workingDirectory: The working directory path.
 * - wcSrcDirectory: The source directory for web components.
 * - testSrcDirectory: The source directory for tests.
 * - doStaticAnalysis: Flag indicating if static analysis should be run.
 * - doCodeFormatting: Flag indicating if code formatting should be run.
 * - doTests: Flag indicating if tests should be run.
 * - testResultsPath: The path to the test results file.
 * - runCoverage: Flag indicating if code coverage should be run.
 * - coveragePassScore: The minimum coverage pass score.
 * - coveragePath: The path to the coverage file.
 * - createComment: Flag indicating if a comment should be created.
 */
const getInputs = (
  isLocal: boolean,
): [
  string,
  string,
  string,
  string,
  boolean,
  boolean,
  boolean,
  string,
  boolean,
  string,
  string,
  boolean,
  string,
  string,
  string,
] => {
  // get the token and octokit
  let token = "";
  if (process.env.GITHUB_TOKEN && isLocal) {
    token = process.env.GITHUB_TOKEN;
  } else {
    token = getInput("token");
  }

  // get directories
  const workingDirectory = isLocal ? "." : getInput("working-directory");

  const wcSrcDirectory = isLocal
    ? "src/**/*.{ts,tsx}"
    : getInput("web-components-src");

  const testSrcDirectory = isLocal
    ? "src/test/**/*.test.ts"
    : getInput("test-src");

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

  const testResultsPath: string = isLocal
    ? "./test-results.xml"
    : getInput("test-results-path");

  // get coverage input
  const runCoverage: boolean = isLocal ? true : getBooleanInput("run-coverage");
  const coveragePassScore: string = isLocal
    ? "80"
    : getInput("coverage-pass-score");
  const coveragePath: string = isLocal
    ? "coverage/lcov.info"
    : getInput("coverage-path");

  // get comment input
  const createComment: boolean = isLocal
    ? true
    : getBooleanInput("create-comment");

  const eslintConfigPath: string = isLocal
    ? "eslint.config.*"
    : getInput("eslint-config-path");

  const testConfigPath: string = isLocal
    ? "web-test-runner.config.*"
    : getInput("test-config-path");

  const esLintCmd: string = isLocal ? "" : getInput("eslint-cmd");

  return [
    token,
    workingDirectory,
    wcSrcDirectory,
    testSrcDirectory,
    doStaticAnalysis,
    doCodeFormatting,
    doTests,
    testResultsPath,
    runCoverage,
    coveragePassScore,
    coveragePath,
    createComment,
    eslintConfigPath,
    testConfigPath,
    esLintCmd,
  ];
};

/**
 * Executes the main workflow for the project, including setting up dependencies,
 * running static analysis, code formatting, tests, and updating changes in the
 * GitHub repository.
 *
 * @returns {Promise<void>} A promise that resolves when the workflow is complete.
 *
 * @throws {Error} If any step in the workflow fails, the error is caught and the
 * workflow run is marked as failed.
 *
 * The workflow includes the following steps:
 * 1. Check if the environment is local.
 * 2. Retrieve inputs based on the environment.
 * 3. Change the working directory if specified.
 * 4. Generate a Custom Elements Manifest using `npx cem analyze`.
 * 5. Run static analysis tools (ESLint, Lit Analyzer, TypeDoc) if enabled.
 * 6. Format code using Prettier if enabled.
 * 7. Install Playwright browsers and run tests if enabled.
 * 8. Calculate and compare code coverage if enabled.
 * 9. Check for modified files and update changes in the GitHub repository if any.
 * 10. Create a comment on the GitHub pull request with the results if enabled.
 */
export async function run(): Promise<void> {
  const isLocal = checkIfLocal();

  try {
    const [
      token,
      workingDirectory,
      wcSrcDirectory,
      testSrcDirectory,
      doStaticAnalysis,
      doCodeFormatting,
      doTests,
      testResultsPath,
      runCoverage,
      coveragePassScore,
      coveragePath,
      createComment,
      eslintConfigPath,
      testConfigPath,
      esLintCmd,
    ] = getInputs(isLocal);

    // Check if the working directory is different from the current directory
    const currentDirectory = cwd();
    if (workingDirectory && workingDirectory !== currentDirectory) {
      chdir(workingDirectory);
    }

    const cemStr: StepResponse | undefined = await commandComment({
      label: "Custom Elements Manifest",
      command: "npx cem analyze",
    });

    // run Static Analysis
    const eslintStr: StepResponse | undefined = doStaticAnalysis
      ? await eslint({
          label: "ESLint",
          command: esLintCmd.isEmpty()
            ? "npx eslint -f unix " +
              wcSrcDirectory +
              " --config " +
              eslintConfigPath
            : esLintCmd,
        })
      : undefined;

    const litAnalyzerStr: StepResponse | undefined = doStaticAnalysis
      ? await litAnalyzer({
          label: "Lit Analyzer",
          command: "npx lit-analyzer --quiet --format markdown",
        })
      : undefined;

    const typeDocStr: StepResponse | undefined = doStaticAnalysis
      ? await typeDoc({
          label: "TypeDoc",
          command: "npx typedoc --logLevel Warn",
        })
      : undefined;

    let webComponentsSrcRoot = wcSrcDirectory.split("/").shift();
    if (webComponentsSrcRoot?.isEmpty()) {
      webComponentsSrcRoot = wcSrcDirectory.split("/")[1];
    }
    // run Code Formatting
    const prettierStr: StepResponse | undefined = doCodeFormatting
      ? await commandComment({
          label: "Prettier",
          command:
            "npx prettier " +
            webComponentsSrcRoot +
            " --write --ignore-unknown",
        })
      : undefined;

    // run Tests
    const playwrightStr: StepResponse | undefined = doTests
      ? await playwright({
          label: "Install PlayWright Browsers",
          command: "npx playwright install --with-deps",
        })
      : undefined;

    const pastCoverageScore: number | undefined = runCoverage
      ? getCoverage(coveragePath)
      : undefined;

    const testingStr: StepResponse | undefined = doTests
      ? await testing(
          {
            label: "Testing",
            command:
              'npx web-test-runner \"' +
              testSrcDirectory +
              '\" --node-resolve --coverage --config ' +
              testConfigPath,
          },
          testResultsPath,
        )
      : undefined;

    const currentCoverageScore: number | undefined = runCoverage
      ? getCoverage(coveragePath)
      : undefined;

    const coverageStr: StepResponse | undefined = runCoverage
      ? await coverage(
          pastCoverageScore,
          currentCoverageScore,
          coveragePassScore,
          coveragePath,
        )
      : undefined;

    const [checkModifiedFilesStr, modified]: [StepResponse, boolean] =
      await checkModifiedFiles({
        label: "Check for modified files",
        command: "git status --porcelain",
      });

    // TODO: THIS DIDN't fail
    const updateChangesStr: StepResponse | undefined = modified
      ? await updateChanges({
          label: "Update changes in GitHub repository",
          command: "",
          commandList: [
            'git config --global user.name "github-actions"',
            'git config --global user.email "github-actions@github.com"',
            "git add -A",
            'git commit -m "[automated commit] lint format and import sort"',
            "git push",
          ],
        })
      : undefined;

    // createComment
    if (createComment) {
      await comment(
        getOctokit(token),
        context,
        cemStr,
        eslintStr,
        litAnalyzerStr,
        prettierStr,
        playwrightStr,
        testingStr,
        coverageStr,
        typeDocStr,
        checkModifiedFilesStr,
        updateChangesStr,
      );
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) setFailed(error.message);
  }
}
