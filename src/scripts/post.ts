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
        console.log("str 1: ", str);
        filesModified = true;
        return await buildComment(response, str, command.label);
      } else {
        console.log("str 2: ", str);
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

  for (const cmd of command.commandList as string[]) {
    console.log("cmd: ", cmd);
    await runBashCommand(cmd).catch(async (error) => {
      setFailed(`Failed to execute command "${cmd}": ${error as string}`);
      response.error = true;
      response = await buildComment(response, error.message, command.label);
      return;
    });
  }

  if (response.error === false) {
    response = await buildComment(response, "", command.label);
  }

  return response;
};
