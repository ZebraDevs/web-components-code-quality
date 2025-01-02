import { setFailed } from "@actions/core";
import { exec } from "@actions/exec";
import * as fs from "fs";
import {
  buildComment,
  Command,
  commandComment,
  failedEmoji,
  passedEmoji,
  runBashCommand,
  StepResponse,
} from "src/main";
import convert from "xml-js";
import parseLCOV from "parse-lcov";

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

export const testing = async (
  command: Command,
  testResultsPath: string,
): Promise<StepResponse> => {
  let response: StepResponse = { output: "", error: false };
  let outputStr = "";
  try {
    await exec(command.command);
  } catch (error) {
    response.error = true;
    setFailed(`Failed ${command.label}: ${error as string}`);
  }

  let testResults = "";
  let failedToReadFile = false;
  try {
    testResults = fs.readFileSync(testResultsPath, "utf8");
  } catch (error) {
    failedToReadFile = true;
    response.error = true;
    outputStr = "Failed to read test results file";
    setFailed(`Failed to read test results: ${error as string}`);
  }

  if (response.error && failedToReadFile == false) {
    const jsonResults = JSON.parse(
      convert.xml2json(testResults, { compact: false, spaces: 2 }),
    );

    fs.writeFileSync(
      "src/test/testResults.json",
      convert.xml2json(testResults, { compact: true, spaces: 2 }),
    );

    outputStr +=
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
          const file = testCase["attributes"]["file"];
          const line = testCase["attributes"]["line"];
          const failureType = testCaseFailure["attributes"]["type"];
          const message = testCaseFailure["attributes"]["message"];
          outputStr += `<tr><td>${file}</td><td>${testCaseName}</td><td>${line}</td><td>${failureType}</td><td>${message}</td></tr>`;
        }
      }
    }

    outputStr += "</table>";
  }
  return await buildComment(response, outputStr, command.label);
};

export const typeDoc = async (command: Command): Promise<StepResponse> => {
  let response: StepResponse = { output: "", error: false };
  let commandOutput = "";
  try {
    await exec(command.command, [], {
      listeners: {
        stderr: (data) => {
          commandOutput += data.toString();
        },
      },
    });
  } catch (error) {
    response.error = true;
    setFailed(`Failed ${command.label}: ${error as string}`);
  }
  console.log("commandOutput: ", commandOutput);

  if (response.error) {
    commandOutput = commandOutput.replace(/\[\d+m/g, "");
    const lines = commandOutput.split("\n");
    const table = lines
      .map((line) => {
        const match = line.match(/^(.*):(\d+):(\d+) - (.*)/);
        if (match) {
          const [_, file, line, column, message] = match;
          return `<tr><td>${file}</td><td>${line}</td><td>${column}</td><td>${message}</td></tr>`;
        }
        return "";
      })
      .join("");
    const outputStr = `<table><tr><th>File</th><th>Line</th><th>Column</th><th>Message</th></tr>${table}</table>`;
    return await buildComment(response, outputStr, command.label);
  }
  return await buildComment(response, "", command.label);
};

export const getCoverage = (): number => {
  let coverage = 0;
  let coverageData;
  try {
    const lcov = fs.readFileSync("coverage/lcov.info", "utf8");
    coverageData = parseLCOV(lcov);
  } catch (error) {
    setFailed(`Failed to read coverage file: ${error as string}`);
  }

  if (coverageData) {
    coverage = coverageData[0].lines.found / coverageData[0].lines.hit;
  }

  return coverage;
};

export const coverage = async (
  pastCoverageScore: number | undefined,
  currentCoverageScore: number | undefined,
  coveragePassScore: string,
): Promise<StepResponse> => {
  let response: StepResponse = { output: "", error: false };

  if (
    currentCoverageScore !== undefined &&
    currentCoverageScore < parseInt(coveragePassScore)
  ) {
    response.error = true;
    response.output = `${failedEmoji} - Coverage: from ${pastCoverageScore}% to ${currentCoverageScore}%`;
  } else {
    response.output = `${passedEmoji} - Coverage: from ${pastCoverageScore}% to ${currentCoverageScore}%`;
  }

  return response;
};
