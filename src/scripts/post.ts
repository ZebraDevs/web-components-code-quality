import { setFailed } from "@actions/core";
import { buildComment, Command, runBashCommand, StepResponse } from "src/main";

/**
 * Checks if there are any modified files by running a given bash command.
 *
 * @param {Command} command - The command to run in the bash shell.
 * @returns {Promise<[StepResponse, boolean]>} A promise that resolves to a tuple containing the step response and a boolean indicating if files were modified.
 *
 * The function executes the provided bash command and processes the output.
 * If the output is not empty, it sets `filesModified` to true.
 * It builds a comment based on the command label and the output or error message.
 * In case of an error, it sets the step as failed and includes the error message in the comment.
 */
export const checkModifiedFiles = async (
  command: Command,
): Promise<[StepResponse, boolean]> => {
  let filesModified = false;
  const result = await runBashCommand(command.command)
    .then(async (str) => {
      const response = { output: "", error: false };
      if (str.trim() !== "") {
        filesModified = true;
        return await buildComment(response, command.label, str);
      } else {
        return await buildComment(response, command.label, str);
      }
    })
    .catch(async (error) => {
      setFailed(`Failed to check for modified files: ${error as string}`);
      const response = { output: "", error: true };
      return await buildComment(response, command.label, error.message);
    });

  return [result, filesModified];
};

/**
 * Updates changes by executing a list of commands and building a response comment.
 *
 * @param {Command} command - The command object containing a list of commands to execute and a label.
 * @returns {Promise<StepResponse>} - A promise that resolves to a StepResponse object containing the output and error status.
 *
 */
export const updateChanges = async (
  command: Command,
): Promise<StepResponse> => {
  let response: StepResponse = { output: "", error: false };

  for (const cmd of command.commandList as string[]) {
    await runBashCommand(cmd).catch(async (error) => {
      setFailed(`Failed to execute command "${cmd}": ${error as string}`);
      response.error = true;
      response = await buildComment(response, command.label, error.message);
      return;
    });
  }

  if (response.error === false) {
    response = await buildComment(response, command.label);
  }

  return response;
};
