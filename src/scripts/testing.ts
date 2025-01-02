import { setFailed } from "@actions/core";
import { exec } from "@actions/exec";
import * as fs from "fs";
import {
  buildComment,
  Command,
  commandComment,
  runBashCommand,
  StepResponse,
} from "src/main";
import convert from "xml-js";

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
    commandOutput = commandOutput.replaceAll(/�\[\d+m/g, "");
    const lines = commandOutput.split("\n");
    const table = lines
      .map((line) => {
        console.log("line: ", line);
        const match = line.match(/^(.*):(\d+):(\d+) - (.*)/);
        console.log("match: ", match);
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

  // outputStr += commandOutput.split("\n").forEach((line) => {
  //   console.log("line: ", line);
  //   let match = line.match(/(.*):(\d+):(\d+) - (.*)/);
  //   console.log("match: ", match);
  //   if (match) {
  //     const [_, filePath, line, column, message] = match;
  //     return `<tr><td>${filePath}</td><td>${line}</td><td>${column}</td><td>${message}</td></tr>`;
  //   }
  // });
  // outputStr += "</table>";
};
