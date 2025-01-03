import {
  StepResponse,
  Command,
  passedEmoji,
  failedEmoji,
  runCommand,
  buildComment,
} from "src/main";

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

export const litAnalyzer = async (command: Command): Promise<StepResponse> => {
  let [response, outputStr] = await runCommand(command);

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

    const problemCount = parseInt(problemsCountStr);

    outputStr = outputStr.split("...").pop()?.trim() || outputStr;
    outputStr = "\n" + outputStr;

    return await buildComment(response, command.label, outputStr, problemCount);
  } else {
    return await buildComment(response, command.label);
  }
};
