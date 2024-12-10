import { exec } from "@actions/exec";
import { setFailed, debug } from "@actions/core";
import { stepResponse } from "src/main";

export const analyze = async (): Promise<stepResponse> => {
  try {
    // Run custom elements manifest analyzer
    let cemAnalyzeOut = "";
    let cemAnalyzeErr = "";
    await exec("npm run analyze", [], {
      listeners: {
        stdout: (data) => {
          cemAnalyzeOut += data.toString();
        },
        stderr: (data) => {
          cemAnalyzeErr += data.toString();
        },
      },
    });

    debug(`cemAnlyzeOut START\n${cemAnalyzeOut}\n\ncemAnalyzeOut END`);
    debug(`cemAnlyzeErr START\n${cemAnalyzeErr}\n\ncemAnalyzeErr END`);

    // Run eslint
    let eslintOut = "";
    let eslintErr = "";
    await exec("npm run lint", [], {
      listeners: {
        stdout: (data) => {
          eslintOut += data.toString();
        },
        stderr: (data) => {
          eslintErr += data.toString();
        },
      },
    });

    debug(`eslintOut START\n${eslintOut}\n\neslintOut END`);
    debug(`eslintErr START\n${eslintErr}\n\neslintErr END`);

    // Run lit-analyzer
    let litAnalyzeOut = "";
    let litAnalyzeErr = "";
    await exec("npm run lint:lit-analyzer", [], {
      listeners: {
        stdout: (data) => {
          litAnalyzeOut += data.toString();
        },
        stderr: (data) => {
          litAnalyzeErr += data.toString();
        },
      },
    });

    debug(`litAnalyzeOut START\n${litAnalyzeOut}\n\nlitAnalyzeOut END`);
    debug(`litAnalyzeErr START\n${litAnalyzeErr}\n\nlitAnalyzeErr END`);

    return { output: "Static analysis complete", error: false };
  } catch (error: unknown) {
    if (error instanceof Error) setFailed(error.message);
    return { output: "Static analysis failed", error: true };
  }
};
