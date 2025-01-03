import { setFailed } from "@actions/core";
import { exec } from "@actions/exec";
import * as fs from "fs";
import {
  buildComment,
  Command,
  commandComment,
  failedEmoji,
  passedEmoji,
  coverageDown,
  coverageUp,
  runBashCommand,
  StepResponse,
} from "src/main";
import convert from "xml-js";
import parseLCOV, { LCOVRecord } from "parse-lcov";

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

  let problemCount = 0;
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
  }
  return await buildComment(response, command.label, outputStr, problemCount);
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

    let problemCount = 0;
    lines.forEach((line) => {
      const match = line.match(/Found (\d+) errors and (\d+) warnings/);
      if (match) {
        const [_, errors, warnings] = match;
        problemCount += parseInt(errors) + parseInt(warnings);
      }
    });

    return await buildComment(response, command.label, outputStr, problemCount);
  }
  return await buildComment(response, command.label);
};

const loadCoverageData = (coveragePath: string): LCOVRecord[] | undefined => {
  let coverageData: LCOVRecord[] | undefined;
  try {
    const lcov = fs.readFileSync(coveragePath, "utf8");
    coverageData = parseLCOV(lcov);
  } catch (error) {
    setFailed(`Failed to read coverage file: ${error as string}`);
  }
  return coverageData;
};

export const getCoverage = (coveragePath: string): number => {
  let coverage = 0;
  let coverageData = loadCoverageData(coveragePath);

  if (coverageData) {
    let linesFound = 0;
    coverageData.forEach((file) => {
      linesFound += file.lines.found;
    });

    let linesHit = 0;
    coverageData.forEach((file) => {
      linesHit += file.lines.hit;
    });

    coverage = linesHit / linesFound;
  }

  return Number((coverage * 100).toFixed(2));
};

export const coverage = async (
  pastCoverageScore: number | undefined,
  currentCoverageScore: number | undefined,
  coveragePassScore: string,
  coveragePath: string,
): Promise<StepResponse> => {
  let response: StepResponse = { output: "", error: false };

  let coverageData = loadCoverageData(coveragePath);
  let coverageTable = coverageDataToTable(coverageData!);

  if (currentCoverageScore !== undefined && pastCoverageScore !== undefined) {
    if (currentCoverageScore < parseInt(coveragePassScore)) {
      response.error = true;
      response.output = `${failedEmoji} - Coverage below ${coveragePassScore}&: ${currentCoverageScore}%\n<details><summary>See Details</summary>${coverageTable}</details>`;
    } else {
      if (pastCoverageScore === currentCoverageScore) {
        response.output = `${passedEmoji} - Coverage: ${currentCoverageScore}%\n<details><summary>See Details</summary>${coverageTable}</details>`;
      } else if (pastCoverageScore > currentCoverageScore) {
        response.output = `${coverageDown} - Coverage: from ${pastCoverageScore}% to ${currentCoverageScore}%\n<details><summary>See Details</summary>${coverageTable}</details>`;
      } else if (pastCoverageScore < currentCoverageScore) {
        response.output = `${coverageUp} - Coverage: from ${pastCoverageScore}% to ${currentCoverageScore}%\n<details><summary>See Details</summary>${coverageTable}</details>`;
      }
    }
  }

  return response;
};

const coverageDataToTable = (coverageData: LCOVRecord[]): string => {
  let table =
    "<table><tr><th>File</th><th>Lines</th><th></th><th>Branches</th><th></th><th>Functions</th><th></th></tr>";

  coverageData.forEach((file) => {
    const linesFound = file.lines.found;
    const linesHit = file.lines.hit;
    const branchesFound = file.branches.found;
    const branchesHit = file.branches.hit;
    const functionsFound = file.functions.found;
    const functionsHit = file.functions.hit;

    const linesCoverage = ((linesHit / linesFound) * 100).toFixed(2);
    const branchesCoverage = ((branchesHit / branchesFound) * 100).toFixed(2);
    const functionsCoverage = ((functionsHit / functionsFound) * 100).toFixed(
      2,
    );

    table += `<tr>
      <td>${file.file}</td>
      <td>${linesCoverage}%</td> <td>${linesHit}/${linesFound}</td>
      <td>${branchesCoverage}%</td> <td>${branchesHit}/${branchesFound}</td>
      <td>${functionsCoverage}%</td> <td>${functionsHit}/${functionsFound}</td>
    </tr>`;
  });

  table += "</table>";
  return table;
};
