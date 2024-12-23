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
    for (let i = 0; i < testSuites.length; i++) {
      const testSuite = testSuites[i];
      console.log(testSuite);
      const testCases = testSuite["elements"].filter(
        (element: any) => element.name === "testcase",
      );
      for (let j = 0; j < testCases.length; j++) {
        const testCase = testCases[j];
        const testCaseName = testCase["attributes"]["name"];
        const testCaseFailure = testCase.filter(
          (element: any) => element["elements"][0].name === "failure",
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

  // const commands = [
  //   // { label: "Testing", command: "npm run test -- --coverage" },
  //   {
  //     label: "Install PlayWright Browsers",
  //     command: "npx playwright install --with-deps",
  //   },
  //   { label: "Testing", command: "npm run test -- --coverage" },
  //   { label: "TSDoc", command: "npm run docs" },
  // ];

  // const [commentBody, errorMessages] = await buildComment(commands);

  // if (errorMessages) {
  //   setFailed(errorMessages.trim());
  //   return { output: commentBody.trim(), error: true };
  // } else {
  //   return { output: commentBody.trim(), error: false };
  // }
};

// function parseXmlToJson(xml: string) {
//   const json: { [key: string]: any } = {};
//   for (const res of xml.matchAll(
//     /(?:<(\w*)(?:\s[^>]*)*>)((?:(?!<\1).)*)(?:<\/\1>)|<(\w*)(?:\s*)*\/>/gm,
//   )) {
//     const key = res[1] || res[3];
//     const value = res[2] && parseXmlToJson(res[2]);
//     json[key] = (value && Object.keys(value).length ? value : res[2]) || null;
//   }
//   return json;
// }
