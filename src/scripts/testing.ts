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
 * Executes a Playwright command and sets the Playwright version in the environment variables.
 *
 * @param {Command} command - The command to be executed.
 * @returns {Promise<StepResponse>} - A promise that resolves to a StepResponse object.
 *
 * @throws {Error} - Throws an error if the Playwright version cannot be retrieved.
 */
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
  let problemCount: number | undefined = undefined;

  try {
    testResults = fs.readFileSync(testResultsPath, "utf8");
  } catch (error) {
    failedToReadFile = true;
    response.error = true;
    outputStr = "Failed to read test results file: " + error;
    setFailed(`Failed to read test results: ${error as string}`);
  }

  if (response.error && !failedToReadFile) {
    const jsonResults = JSON.parse(
      convert.xml2json(testResults, { compact: false, spaces: 2 }),
    );

    const testSuites = jsonResults.elements[0].elements;
    const testCases = testSuites.flatMap(
      (suite: any) =>
        suite.elements?.filter((element: any) => element.name === "testcase") ??
        [],
    );

    const failedTestCases = testCases.filter((testCase: any) =>
      testCase.elements?.some((element: any) => element.name === "failure"),
    );

    problemCount = failedTestCases.length;

    if (problemCount! > 0) {
      outputStr = `
        <table>
          <tr>
            <th>File</th>
            <th>Test Name</th>
            <th>Line</th>
            <th>Type</th>
            <th>Message</th>
          </tr>
          ${failedTestCases
            .map((testCase: any) => {
              const { name: testCaseName, file, line } = testCase.attributes;
              const failure = testCase.elements.find(
                (element: any) => element.name === "failure",
              );
              const { type: failureType, message } = failure.attributes;
              return `
              <tr>
                <td>${file}</td>
                <td>${testCaseName}</td>
                <td>${line}</td>
                <td>${failureType}</td>
                <td>${message}</td>
              </tr>
            `;
            })
            .join("")}
        </table>
      `;
    } else {
      outputStr = "Test Run Failed";
    }
  }
  return await buildComment(
    response,
    command.label,
    outputStr,
    problemCount ?? undefined,
  );

  // let problemCount = 0;
  // if (response.error && !failedToReadFile) {
  //   const jsonResults = JSON.parse(
  //     convert.xml2json(testResults, { compact: false, spaces: 2 }),
  //   );

  //   outputStr =
  //     "<table><tr><th>File</th><th>Test Name</th><th>Line</th><th>Type</th><th>Message</th></tr>";

  //   const testSuites = jsonResults["elements"][0]["elements"];
  //   for (const testSuite of testSuites) {
  //     const testCases =
  //       testSuite["elements"]?.filter(
  //         (element: any) => element.name === "testcase",
  //       ) ?? [];

  //     for (const testCase of testCases) {
  //       const testCaseName = testCase["attributes"]["name"];
  //       const testCaseFailure = testCase["elements"]?.find(
  //         (element: any) => element.name === "failure",
  //       );

  //       if (testCaseFailure) {
  //         problemCount++;
  //         const file = testCase["attributes"]["file"];
  //         const line = testCase["attributes"]["line"];
  //         const failureType = testCaseFailure["attributes"]["type"];
  //         const message = testCaseFailure["attributes"]["message"];
  //         outputStr += `<tr><td>${file}</td><td>${testCaseName}</td><td>${line}</td><td>${failureType}</td><td>${message}</td></tr>`;
  //       }
  //     }
  //   }

  //   outputStr += "</table>";

  //   if (problemCount < 1) {
  //     outputStr = "Test Run Failed";
  //   }
  // }

  // return await buildComment(response, command.label, outputStr, problemCount);
};
