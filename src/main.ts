import { getBooleanInput, getInput, setFailed } from "@actions/core";
import { exec } from "@actions/exec";
import { getOctokit, context } from "@actions/github";
import { analyze } from "./scripts/analyze";
import { formatting } from "./scripts/formatting";
import { testing } from "./scripts/testing";
import { comment } from "./scripts/comment";
// import { coverage } from './scripts/coverage'
// import minimist from "minimist";

export type stepResponse = { output: string; error: boolean };

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  // const argv = minimist(process.argv);
  // console.log("ARGV MINIMIST!!!", argv);

  try {
    await exec("npm ci");
  } catch (error) {
    if (error instanceof Error) setFailed(error.message);
  }

  try {
    const workingDirectory: string = getInput("working-directory");
    // Check if the working directory is different from the current directory
    if (workingDirectory && workingDirectory !== process.cwd()) {
      process.chdir(workingDirectory);
    }

    // const token: string = process.env.GITHUB_TOKEN;
    const token: string = getInput("token");
    const octokit = getOctokit(token);
    const runStaticAnalysis: boolean = getBooleanInput("run-static-analysis");
    const runCodeFormatting: boolean = getBooleanInput("run-code-formatting");
    const runTests: boolean = getBooleanInput("run-tests");
    // const runCoverage: boolean = getBooleanInput('run-coverage');
    // const coveragePassScore: string = getInput('coverage-pass-score');
    const createComment: boolean = getBooleanInput("create-comment");

    // runStaticAnalysis
    const analyzeStr: stepResponse | undefined = runStaticAnalysis
      ? await analyze()
      : undefined;

    // runCodeFormatting
    const runCodeFormattingStr: stepResponse | undefined = runCodeFormatting
      ? await formatting()
      : undefined;

    // runTests
    const testingStr: stepResponse | undefined = runTests
      ? await testing()
      : undefined;

    // runCoverage
    // const coverageStr: stepResponse | undefined = runCoverage
    //   ? await coverage()
    //   : undefined

    // createComment
    if (createComment) {
      comment(octokit, context, analyzeStr, runCodeFormattingStr, testingStr);
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) setFailed(error.message);
  }
}
