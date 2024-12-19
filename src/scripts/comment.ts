import { setFailed } from "@actions/core";
import { getOctokit } from "@actions/github";
import { Context } from "@actions/github/lib/context";
import { StepResponse } from "src/main";

const li = (str: string): string => {
  return `<li>${str}</li>`;
};

export const comment = async (
  ocotokit: ReturnType<typeof getOctokit>,
  context: Context,
  npmIStr: StepResponse | undefined,
  cemStr: StepResponse | undefined,
  eslintStr: StepResponse | undefined,
  litAnalyzerStr: StepResponse | undefined,
  prettierStr: StepResponse | undefined,
  playwrightStr: StepResponse | undefined,
  testingStr: StepResponse | undefined,
  tsDocStr: StepResponse | undefined,
): Promise<StepResponse> => {
  try {
    const commentBody = `
  ## PR Checks Complete\n
  <ul>
    ${npmIStr !== undefined ? li(npmIStr.output) : ""}
    ${cemStr !== undefined ? li(cemStr.output) : ""}
    ${eslintStr !== undefined ? li(eslintStr.output) : ""}
    ${litAnalyzerStr !== undefined ? li(litAnalyzerStr.output) : ""}
    ${prettierStr !== undefined ? li(prettierStr.output) : ""}
    ${playwrightStr !== undefined ? li(playwrightStr.output) : ""}
    ${testingStr !== undefined ? li(testingStr.output) : ""}
    ${tsDocStr !== undefined ? li(tsDocStr.output) : ""}
  </ul>`;
    // ## Coverage = ${coverageStr?.output}\n`

    const { data: comments } = await ocotokit.rest.issues.listComments({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
    });
    const comment = comments.find((comment) =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      comment.body!.includes("PR Checks Complete"),
    );
    if (comment) {
      await ocotokit.rest.issues.updateComment({
        comment_id: comment.id,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: commentBody,
      });
    } else {
      await ocotokit.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: commentBody,
      });
    }
    return { output: "Comment successful", error: false };
  } catch (error) {
    if (error instanceof Error) setFailed(error.message);
    return { output: "Comment failed", error: true };
  }
};
