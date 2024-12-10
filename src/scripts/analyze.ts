import { exec } from "@actions/exec";
import { setFailed, debug } from "@actions/core";
import { stepResponse } from "src/main";

export const analyze = async (): Promise<stepResponse> => {
  try {
    // Run custom elements manifest analyzer
    let cemAnalyzeOut: string = "";
    let cemAnalyzeErr: string = "";
    await exec("npm run analyze", [], {
      listeners: {
        stdout: (data: Buffer) => {
          cemAnalyzeOut += data.toString();
        },
        stderr: (data: Buffer) => {
          cemAnalyzeErr += data.toString();
        },
      },
    });

    debug(`cemAnlyzeOut START\n${cemAnalyzeOut}\n\ncemAnalyzeOut END`);
    debug(`cemAnlyzeErr START\n${cemAnalyzeErr}\n\ncemAnalyzeErr END`);

    // Run eslint
    let eslintOut: string = "";
    let eslintErr: string = "";
    await exec("npm run lint", [], {
      listeners: {
        stdout: (data: Buffer) => {
          eslintOut += data.toString();
        },
        stderr: (data: Buffer) => {
          eslintErr += data.toString();
        },
      },
    });

    debug(`eslintOut START\n${eslintOut}\n\neslintOut END`);
    debug(`eslintErr START\n${eslintErr}\n\neslintErr END`);

    // Run lit-analyzer
    let litAnalyzeOut: string = "";
    let litAnalyzeErr: string = "";
    await exec("npm run lint:lit-analyzer", [], {
      listeners: {
        stdout: (data: Buffer) => {
          litAnalyzeOut += data.toString();
        },
        stderr: (data: Buffer) => {
          litAnalyzeErr += data.toString();
        },
      },
    });

    debug(`litAnalyzeOut START\n${litAnalyzeOut}\n\nlitAnalyzeOut END`);
    debug(`litAnalyzeErr START\n${litAnalyzeErr}\n\nlitAnalyzeErr END`);

    return { output: "Static analysis complete", error: false };
  } catch (error) {
    if (error instanceof Error) setFailed(error.message);
    return { output: "Static analysis failed", error: true };
  }
};
