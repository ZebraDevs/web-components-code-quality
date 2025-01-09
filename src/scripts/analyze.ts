import { StepResponse, Command, runCommand, buildComment } from "src/main";
import { exec } from "@actions/exec";
import { setFailed } from "@actions/core";

/**
 * Executes an ESLint command and processes the output to generate an HTML table of linting issues.
 *
 * @param {Command} command - The command to run ESLint.
 * @returns {Promise<StepResponse>} - A promise that resolves to a StepResponse containing the linting results.
 *
 * The function performs the following steps:
 * 1. Runs the provided ESLint command.
 * 2. Parses the output string to extract linting issues.
 * 3. Constructs an HTML table with the linting issues.
 * 4. Counts the number of linting issues.
 * 5. Builds and returns a comment with the linting results.
 */
export const eslint = async (command: Command): Promise<StepResponse> => {
  const [response, outputStr] = await runCommand(command);

  const lines = outputStr.split("\n");
  const table = lines
    .map((line) => {
      const match = line.match(/^(.*?):(\d+):(\d+): (.*)$/);
      if (match) {
        const [_, file, line, column, message] = match;
        return `<tr><td>${file}</td><td>${line}</td><td>${column}</td><td>${message}</td></tr>`;
      }
      return "";
    })
    .join("");

  const problemCount = lines.filter((line) =>
    line.match(/^(.*?):(\d+):(\d+): (.*)$/),
  ).length;

  const str = `<table><tr><th>File</th><th>Line</th><th>Column</th><th>Message</th></tr>${table}</table>`;

  return await buildComment(response, command.label, str, problemCount);
};

/**
 * Analyzes the output of a given command using the lit-analyzer tool.
 *
 * @param {Command} command - The command to be executed and analyzed.
 * @returns {Promise<StepResponse>} A promise that resolves to a StepResponse object containing the analysis results.
 *
 * The function executes the provided command and processes its output. If the command execution results in an error,
 * it parses the output to extract the number of problems found and builds a detailed comment. If the command executes
 * successfully, it builds a simple success comment.
 */
export const litAnalyzer = async (command: Command): Promise<StepResponse> => {
  let [response, outputStr] = await runCommand(command);
  let problemCount = 0;
  if (response.error == true) {
    const lines = outputStr.split("\n");
    const problemsCountStr = lines
      .map((line) => {
        const match = line.match(
          /^\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|$/,
        );
        if (match) {
          const [filesChecked, filesWithProblems, problems, errors, warnings] =
            match;
          return problems;
        }
      })
      .join("");

    problemCount = parseInt(problemsCountStr);

    outputStr = outputStr.split("...").pop() || outputStr;
  }
  return await buildComment(response, command.label, outputStr, problemCount);
};

/**
 * Executes a TypeDoc command and processes the output.
 *
 * @param {Command} command - The command to execute.
 * @returns {Promise<StepResponse>} - A promise that resolves to a StepResponse object containing the output and error status.
 *
 * The function attempts to execute the provided command using `exec`. If the command fails, it sets the error status in the response.
 * It processes the command output to extract error messages and formats them into an HTML table.
 * Additionally, it counts the number of errors and warnings found in the output.
 *
 * The final response is built using the `buildComment` function, which includes the formatted output and problem count.
 */
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

  let outputStr = "";
  let problemCount = 0;

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
    outputStr = `<table><tr><th>File</th><th>Line</th><th>Column</th><th>Message</th></tr>${table}</table>`;

    lines.forEach((line) => {
      const match = line.match(/Found (\d+) errors and (\d+) warnings/);
      if (match) {
        const [_, errors, warnings] = match;
        problemCount += parseInt(errors) + parseInt(warnings);
      }
    });
  }

  return await buildComment(response, command.label, outputStr, problemCount);
};
