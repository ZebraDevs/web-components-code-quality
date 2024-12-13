import { setFailed } from "@actions/core";
import { exec } from "@actions/exec";
import { stepResponse, buildComment, Command, passedEmoji } from "src/main";

export const analyze = async (): Promise<stepResponse> => {
  const commands = [
    { label: "Custom Elements Manifest Analyzer", command: "npm run analyze" },
    { label: "Lit Analyzer", command: "npm run lint:lit-analyzer" },
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
