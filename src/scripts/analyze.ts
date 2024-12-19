import { setFailed } from "@actions/core";
import { exec } from "@actions/exec";
import {
  stepResponse,
  buildComment,
  Command,
  passedEmoji,
  failedEmoji,
} from "src/main";

export const eslint = async (command: Command): Promise<stepResponse> => {
  let response: stepResponse = { output: "", error: false };
  let outputStr = "";
  try {
    await exec(command.command, [], {
      listeners: {
        stdout: (data) => {
          outputStr += data.toString();
        },
      },
    });
  } catch (error) {
    setFailed(`Failed ${command.label}: ${error}`);
  }

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

  if (problemCount > 0) {
    response.error = true;
    response.output = `${failedEmoji} - ${command.label}: ${problemCount} problem${problemCount !== 1 ? "s" : ""} found\n<details><summary>See Details</summary><table><tr><th>File</th><th>Line</th><th>Column</th><th>Message</th></tr>${table}</table></details>`;
  } else {
    response.output = `${passedEmoji} - ${command.label}\n`;
  }
  return response;
};

// const customElementsManifestAnalyzer = async (
//   command: Command,
// ): Promise<stepResponse> => {};

export const litAnalyzer = async (command: Command): Promise<stepResponse> => {
  let response: stepResponse = { output: "", error: false };
  let outputStr = "";
  try {
    await exec(command.command, [], {
      listeners: {
        stdout: (data) => {
          outputStr += data.toString();
        },
      },
    });
  } catch (error) {
    setFailed(`Failed ${command.label}: ${error}`);
    response.error = true;
  }

  if (response.error == true) {
    const lines = outputStr.split("\n");
    // const table = lines
    //   .map((line) => {
    //     const match = line.match(/^(.*?):(\d+):(\d+): (.*)$/);
    //     if (match) {
    //       const [_, file, line, message] = match;
    //       return `<tr><td>${file}</td><td>${line}</td><td>${message}</td></tr>`;
    //     }
    //     return "";
    //   })
    //   .join("");

    const problemsLine = lines.filter((line) =>
      line.match(
        /^\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|$/,
      ),
    );

    const [_, __, problemCountStr, ___, ____] = problemsLine;
    const problemCount = parseInt(problemCountStr);
    // const problemCount =
    //   problemsLine.length > 0
    //     ? parseInt(problemsLine[0].match(/(\d+) problem/)![1])
    //     : 0;

    response.output = `${failedEmoji} - ${command.label}: ${problemCount} problem${problemCount !== 1 ? "s" : ""} found\n<details><summary>See Details</summary>${outputStr}</details>`;

    return response;
  } else {
    response.output = `${passedEmoji} - ${command.label}\n`;
    return response;
  }
};

export const analyze = async (): Promise<stepResponse> => {
  const commands = [
    { label: "Custom Elements Manifest Analyzer", command: "npm run analyze" },
  ];

  const [commentBody, errorMessages] = await buildComment(commands);

  if (errorMessages) {
    setFailed(errorMessages.trim());
    return { output: commentBody.trim(), error: true };
  } else {
    return { output: commentBody.trim(), error: false };
  }
};

// export const buildComment = async (
//   commands: { label: string; command: string }[],
// ): Promise<string[]> => {
//   let commentBody = "\n";
//   let errorMessages = "";
//   for (const { label, command } of commands) {
//     const result = await runCommand(command, label);
//     if (result) {
//       commentBody += `<li>${failedEmoji} - ${label}
// <details><summary>See details</summary>${result}</details></li>`;
//       errorMessages += `${result}`;
//     } else {
//       commentBody += `<li>${passedEmoji} - ${label}\n</li>`;
//     }
//   }
//   return [commentBody, errorMessages];
// };

// export const runCommand = async (
//   command: string,
//   label: string,
// ): Promise<string | boolean> => {
//   let output = "";
//   try {
//     await exec(command, [], {
//       listeners: {
//         stdout: (data) => {
//           output += data.toString();
//         },
//       },
//     });
//     return false;
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       debug(`${label} failed: ${error.message}`);
//       return output;
//     } else if (typeof error === "string") {
//       debug(`${label} failed: ${error}`);
//       return output;
//     } else {
//       return true;
//     }
//   }
// };
