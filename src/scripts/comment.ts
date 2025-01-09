import { setFailed } from "@actions/core";
import { getOctokit } from "@actions/github";
import { Context } from "@actions/github/lib/context";
import { failedEmoji, passedEmoji, StepResponse } from "src/main";

/**
 * Generates a formatted message for a group of steps.
 *
 * @param {string} name - The name of the group.
 * @param {StepResponse[]} steps - An array of step responses.
 * @param {boolean} showOnPass - A boolean indicating whether to show the message even if all steps pass.
 * @returns {string} A formatted string message for the group of steps.
 */
const group = (
  name: string,
  steps: StepResponse[],
  showOnPass: boolean,
): string => {
  const isError = steps.some((step) => step.error);
  if (showOnPass || isError) {
    let message = `### ${isError ? failedEmoji : passedEmoji} ${name}\n`;
    steps.forEach((step) => {
      message += `${step !== undefined ? li(step.output) : ""}`;
    });
    return message;
  } else {
    return "";
  }
};

/**
 * Generates an HTML list item (`<li>`) element containing the provided string.
 *
 * @param {string} str - The string to be included within the list item.
 * @returns {string} The HTML string representing the list item.
 */
const li = (str: string): string => {
  return `
<li>
  ${str}
</li>
`;
};

/**
 * Posts a comment on a GitHub issue or pull request summarizing the results of various checks.
 * If a comment with the summary already exists, it updates the comment instead.
 *
 * @param {ReturnType<typeof getOctokit>} ocotokit - The Octokit instance for making GitHub API requests.
 * @param {Context} context - The context of the GitHub action, including issue and repository information.
 * @param {StepResponse | undefined} npmIStr - The result of the npm install step.
 * @param {StepResponse | undefined} cemStr - The result of the custom element manifest step.
 * @param {StepResponse | undefined} eslintStr - The result of the ESLint step.
 * @param {StepResponse | undefined} litAnalyzerStr - The result of the Lit Analyzer step.
 * @param {StepResponse | undefined} prettierStr - The result of the Prettier formatting step.
 * @param {StepResponse | undefined} playwrightStr - The result of the Playwright testing step.
 * @param {StepResponse | undefined} testingStr - The result of the general testing step.
 * @param {StepResponse | undefined} coverageStr - The result of the code coverage step.
 * @param {StepResponse | undefined} typeDocStr - The result of the TypeDoc documentation generation step.
 * @param {StepResponse | undefined} checkModifiedFilesStr - The result of the check for modified files step.
 * @param {StepResponse | undefined} updateChangesStr - The result of the update changes step.
 * @returns {Promise<StepResponse>} A promise that resolves to a StepResponse indicating the success or failure of the comment operation.
 */
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
    let commentBody = `
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
