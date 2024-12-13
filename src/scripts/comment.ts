import { setFailed } from "@actions/core";
import { getOctokit } from "@actions/github";
import { Context } from "@actions/github/lib/context";
import { stepResponse } from "src/main";

export const comment = async (
  ocotokit: ReturnType<typeof getOctokit>,
  context: Context,
  setupStr: stepResponse | undefined,
  analyzeStr: stepResponse | undefined,
  codeFormattingStr: stepResponse | undefined,
  testingStr: stepResponse | undefined,
): Promise<stepResponse> => {
  try {
    const commentBody = `
## PR Checks Complete\n
<ul>
${setupStr?.output}
${analyzeStr?.output}
${codeFormattingStr?.output}
${testingStr?.output}
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
