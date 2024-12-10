import { setFailed } from "@actions/core";
import { getOctokit } from "@actions/github";
import { Context } from "@actions/github/lib/context";
import { stepResponse } from "src/main";

export const comment = async (
  ocotokit: ReturnType<typeof getOctokit>,
  context: Context,
  analyzeStr: stepResponse | undefined,
  runCodeFormattingStr: stepResponse | undefined,
  testingStr: stepResponse | undefined,
): Promise<stepResponse> => {
  try {
    const commentBody = `## Static Analysis = ${analyzeStr?.output}\n
    ## Code Formatting = ${runCodeFormattingStr?.output}\n
    ## Testing = ${testingStr?.output}\n`;
    //    ## Coverage = ${coverageStr?.output}\n`

    await ocotokit.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: commentBody,
    });
    return { output: "RETURN COVERAGE", error: false };
  } catch (error) {
    if (error instanceof Error) setFailed(error.message);
    return { output: "Coverage failed", error: true };
  }
};
