import { setFailed } from "@actions/core";
import * as fs from "fs";
import {
  buildComment,
  Command,
  commandComment,
  runBashCommand,
  runCommand,
  StepResponse,
} from "src/main";
import convert from "xml-js";

/**
 * Installs Playwright browser binaries for every version of the `playwright`
 * package present in `node_modules`. Projects may depend on multiple versions
 * simultaneously (e.g. `@playwright/test` and `@web/test-runner-playwright`
 * can resolve to different releases), and each version needs its own binaries
 * installed at its own cache path.
 *
 * @param {Command} command - The base command (used as a fallback label/command).
 * @returns {Promise<StepResponse>} - A promise that resolves to a StepResponse object.
 */
export const playwright = async (command: Command): Promise<StepResponse> => {
  let clis: string[] = [];
  try {
    const found = await runBashCommand(
      "find node_modules -name 'cli.js' -path '*/playwright/cli.js' ! -path '*/playwright-core/*'",
    );
    clis = found.trim().split("\n").filter(Boolean);
  } catch (_) {
    // fall through to default command if find fails
  }

  const installCommands =
    clis.length > 0
      ? clis.map((cli) => ({
          ...command,
          label: `${command.label} (${cli})`,
          command: `node "${cli}" install --with-deps`,
        }))
      : [command];

  let response: StepResponse = { output: "", error: false };
  for (const cmd of installCommands) {
    response = await commandComment(cmd);
    if (response.error) return response;
  }
  return response;
};

/**
 * Executes a given command and processes the test results.
 *
 * @param command - The command to be executed.
 * @param testResultsPath - The file path to the test results.
 * @returns A promise that resolves to a `StepResponse` object containing the results of the command execution and test results processing.
 *
 * The function performs the following steps:
 * 1. Executes the provided command using `runCommand`.
 * 2. Attempts to read the test results from the specified file path.
 * 3. If the test results file is successfully read, it parses the XML content and converts it to JSON.
 * 4. Constructs an HTML table summarizing the test results, including file, test name, line, type, and message for each failed test case.
 * 5. If no test cases failed, sets the output string to "Test Run Failed".
 * 6. Returns the result of `buildComment` with the response, command label, output string, and problem count.
 *
 * @throws Will set the response error and output string if reading the test results file fails.
 */
export const testing = async (
  command: Command,
  testResultsPath: string,
): Promise<StepResponse> => {
  let [response, outputStr] = await runCommand(command);
  let testResults = "";
  let failedToReadFile = false;

  try {
    testResults = fs.readFileSync(testResultsPath, "utf8");
  } catch (error) {
    failedToReadFile = true;
    response.error = true;
    outputStr = "Failed to read test results file: " + error;
    setFailed(`Failed to read test results: ${error as string}`);
  }

  let problemCount = 0;
  if (response.error && !failedToReadFile) {
    const jsonResults = JSON.parse(
      convert.xml2json(testResults, { compact: false, spaces: 2 }),
    );

    outputStr =
      "<table><tr><th>File</th><th>Test Name</th><th>Line</th><th>Type</th><th>Message</th></tr>";

    const testSuites = jsonResults["elements"][0]["elements"];
    for (const testSuite of testSuites) {
      const testCases =
        testSuite["elements"]?.filter(
          (element: any) => element.name === "testcase",
        ) ?? [];

      for (const testCase of testCases) {
        const testCaseName = testCase["attributes"]["name"];
        const testCaseFailure = testCase["elements"]?.find(
          (element: any) => element.name === "failure",
        );

        if (testCaseFailure) {
          problemCount++;
          const file = testCase["attributes"]["file"];
          const line = testCase["attributes"]["line"];
          const failureType = testCaseFailure["attributes"]["type"];
          const message = testCaseFailure["attributes"]["message"];
          outputStr += `<tr><td>${file}</td><td>${testCaseName}</td><td>${line}</td><td>${failureType}</td><td>${message}</td></tr>`;
        }
      }
    }

    outputStr += "</table>";

    if (problemCount < 1) {
      outputStr = "Test Run Failed";
    }
  }

  return await buildComment(response, command.label, outputStr, problemCount);
};
