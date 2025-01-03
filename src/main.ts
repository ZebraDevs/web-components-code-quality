import { getBooleanInput, getInput, setFailed } from "@actions/core";
import { exec } from "@actions/exec";
import { getOctokit, context } from "@actions/github";
import { eslint, litAnalyzer } from "./scripts/analyze";
import {
  coverage,
  getCoverage,
  playwright,
  testing,
  typeDoc,
} from "./scripts/testing";
import { comment } from "./scripts/comment";
import { cwd, chdir } from "process";
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
export const coverageUp = "📈";
export const coverageDown = "📉";

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
] => {
  // get the token and octokit
  let token = "";
  if (process.env.GITHUB_TOKEN && isLocal) {
    token = process.env.GITHUB_TOKEN;
  } else {
    token = getInput("token");
  }

  const workingDirectory = getInput("working-directory");

  const wcSrcDirectory = getInput("web-components-src");

  const testSrcDirectory = getInput("test-src");

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

  const runCoverage: boolean = getBooleanInput("run-coverage");
  const coveragePassScore: string = getInput("coverage-pass-score");
  const coveragePath: string = getInput("coverage-path");

  // get comment input
  const createComment: boolean = isLocal
    ? true
    : getBooleanInput("create-comment");

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

    const cemStr: StepResponse | undefined = await commandComment({
      label: "Custom Elements Manifest",
      command: "npx cem analyze",
    });

    // run Static Analysis
    const eslintStr: StepResponse | undefined = doStaticAnalysis
      ? await eslint({
          label: "ESLint",
          // TODO: change to -format json
          command: "npx eslint -f unix " + wcSrcDirectory,
        })
      : undefined;

    const litAnalyzerStr: StepResponse | undefined = doStaticAnalysis
      ? await litAnalyzer({
          label: "Lit Analyzer",
          command: "npx lit-analyzer --quiet --format markdown",
        })
      : undefined;

    let webComponentsSrcRoot = wcSrcDirectory.split("/").shift();
    if (
      webComponentsSrcRoot == undefined ||
      webComponentsSrcRoot == "" ||
      webComponentsSrcRoot == null
    ) {
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
              'npx web-test-runner "' +
              testSrcDirectory +
              '" --node-resolve --coverage',
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
        )
      : undefined;

    const typeDocStr: StepResponse | undefined = doTests
      ? await typeDoc({
          label: "TypeDoc",
          command: "npx typedoc --logLevel Warn",
        })
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
        npmIStr,
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
