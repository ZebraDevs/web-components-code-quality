import { setFailed } from "@actions/core";
import { buildComment, Command, runBashCommand, StepResponse } from "src/main";

export const checkModifiedFiles = async (
  command: Command,
): Promise<StepResponse> => {
  const result = await runBashCommand(command.command)
    .then(async (str) => {
      const response = { output: "", error: false };
      return await buildComment(response, str, command.label);
    })
    .catch((error) => {
      setFailed(`Failed to check for modified files: ${error as string}`);
      return { output: error.message as string, error: true };
    });

  return result;
};
