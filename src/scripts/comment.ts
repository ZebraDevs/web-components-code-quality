import { setFailed } from "@actions/core";
import { getOctokit } from "@actions/github";
import { Context } from "@actions/github/lib/context";
import { failedEmoji, passedEmoji, StepResponse } from "src/main";

const group = (
  name: string,
  steps: StepResponse[],
  showOnPass: boolean,
): string => {
  const isError = steps.some((step) => step.error);
  let message = "";
  if (isError) {
    message += `<details><summary>${failedEmoji} - ${name}</summary>`;
    for (const step in steps) {
      if (steps[step].output.split(":").length == 3) {
        const [count, label, output] = steps[step].output.split(":");
        message += `&emsp;${failedEmoji} ${label}: ${count} problem${parseInt(count) > 1 ? "s" : ""}\n`;
        message += `&emsp;${output}\n`;
      } else if (steps[step].error) {
        const [label, output] = steps[step].output.split(":");
        message += `&emsp;${failedEmoji} ${label}\n`;
        message += `&emsp;${output}\n`;
      } else if (!steps[step].error) {
        const [label, output] = steps[step].output.split(":");
        message += `&emsp;${passedEmoji} ${label}\n`;
      }
    }
    message += `</details>`;
  } else if (showOnPass) {
    message = `&emsp;<p>${passedEmoji} - ${name}</p>\n`;
  } else {
    message = "";
  }

  return message;
};

const li = (str: string): string => {
  return `
  
<li>
  ${str}
</li>

`;
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
  coverageStr: StepResponse | undefined,
  typeDocStr: StepResponse | undefined,
  checkModifiedFilesStr: StepResponse | undefined,
  updateChangesStr: StepResponse | undefined,
): Promise<StepResponse> => {
  try {
    let setup = [];
    let analysis = [];
    let formatting = [];
    let testing = [];
    let postChecks = [];
    if (npmIStr !== undefined) setup.push(npmIStr);
    if (cemStr !== undefined) setup.push(cemStr);
    if (eslintStr !== undefined) analysis.push(eslintStr);
    if (litAnalyzerStr !== undefined) analysis.push(litAnalyzerStr);
    if (typeDocStr !== undefined) analysis.push(typeDocStr);
    if (prettierStr !== undefined) formatting.push(prettierStr);
    if (playwrightStr !== undefined) testing.push(playwrightStr);
    if (testingStr !== undefined) testing.push(testingStr);
    if (coverageStr !== undefined) testing.push(coverageStr);
    if (checkModifiedFilesStr !== undefined)
      postChecks.push(checkModifiedFilesStr);
    if (updateChangesStr !== undefined) postChecks.push(updateChangesStr);
    // ${npmIStr !== undefined ? li(npmIStr.output) : ""}
    // ${cemStr !== undefined ? li(cemStr.output) : ""}
    // ${eslintStr !== undefined ? li(eslintStr.output) : ""}
    // ${litAnalyzerStr !== undefined ? li(litAnalyzerStr.output) : ""}
    // ${prettierStr !== undefined ? li(prettierStr.output) : ""}
    // ${playwrightStr !== undefined ? li(playwrightStr.output) : ""}
    // ${testingStr !== undefined ? li(testingStr.output) : ""}
    // ${coverageStr !== undefined ? li(coverageStr.output) : ""}
    // ${typeDocStr !== undefined ? li(typeDocStr.output) : ""}
    // ${checkModifiedFilesStr !== undefined ? li(checkModifiedFilesStr.output) : ""}
    // ${updateChangesStr !== undefined ? li(updateChangesStr.output) : ""}
    const commentBody = `
## PR Checks Complete\n
${group("Setup", setup, false)}
${group("Analysis", analysis, true)}
${group("Formatting", formatting, true)}
${group("Testing", testing, true)}
${group("Post Checks", postChecks, false)}
`;

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
