import { setFailed } from "@actions/core";
import { buildComment, Command, runBashCommand, StepResponse } from "src/main";

export const checkModifiedFiles = async (
  command: Command,
): Promise<[StepResponse, boolean]> => {
  let filesModified = false;
  const result = await runBashCommand(command.command)
    .then(async (str) => {
      const response = { output: "", error: false };
      if (str.trim() !== "") {
        filesModified = true;
        return await buildComment(response, str, command.label);
      } else {
        return await buildComment(response, str, command.label);
      }
    })
    .catch(async (error) => {
      setFailed(`Failed to check for modified files: ${error as string}`);
      const response = { output: "", error: true };
      return await buildComment(response, error.message, command.label);
    });

  return [result, filesModified];
};

export const updateChanges = async (
  command: Command,
): Promise<StepResponse> => {
  let response: StepResponse = { output: "", error: false };

  if (process.env.MODIFIED === "true") {
    for (const cmd of command.commandList as string[]) {
      await runBashCommand(cmd).catch(async (error) => {
        setFailed(`Failed to execute command "${cmd}": ${error as string}`);
        response.error = true;
        response = await buildComment(response, error.message, command.label);
        return;
      });
    }
  } else {
    response.error = true;
    response = await buildComment(
      response,
      "process.env.MODIFIED == false",
      command.label,
    );
  }

  if (response.error === false) {
    response = await buildComment(response, "", command.label);
  }

  return response;
};
