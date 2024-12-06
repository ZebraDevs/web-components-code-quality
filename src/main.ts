import { getBooleanInput, getInput, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { getOctokit, context } from '@actions/github'
import { analyze } from './scripts/analyze'
import { formatting } from './scripts/formatting'
import { testing } from './scripts/testing'
import { coverage } from './scripts/coverage'

export type stepResponse = { output: string; error: boolean }

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    await exec('npm ci')
  } catch (error) {
    if (error instanceof Error) setFailed(error.message)
  }

  try {
    const workingDirectory: string = getInput('working-directory')
    // Check if the working directory is different from the current directory
    if (workingDirectory && workingDirectory !== process.cwd()) {
      process.chdir(workingDirectory)
    }

    const token: string = getInput('token')
    const octokit = getOctokit(token)
    const runStaticAnalysis: boolean = getBooleanInput('run-static-analysis')
    const runCodeFormatting: boolean = getBooleanInput('run-code-formatting')
    const runTests: boolean = getBooleanInput('run-tests')
    const runCoverage: boolean = getBooleanInput('run-coverage')
    // const coveragePassScore: string = getInput('coverage-pass-score')
    // const createComment: boolean = getBooleanInput('create-comment')

    // if (runStaticAnalysis) { then run static analysis script }
    const analyzeStr: stepResponse | undefined = runStaticAnalysis
      ? await analyze()
      : undefined

    // if (runCodeFormatting) { then run code formatting script }
    const runCodeFormattingStr: stepResponse | undefined = runCodeFormatting
      ? await formatting()
      : undefined

    // if (runTests) { then run tests script, passing in the coveragePassScore }
    const testingStr: stepResponse | undefined = runTests
      ? await testing()
      : undefined

    // const coverageStr: stepResponse | undefined = runCoverage
    //   ? await coverage()
    //   : undefined

    const commentBody = `## Static Analysis = ${analyzeStr?.output}\n
    ## Code Formatting = ${runCodeFormattingStr?.output}\n
    ## Testing = ${testingStr?.output}\n`
    //    ## Coverage = ${coverageStr?.output}\n`

    await octokit.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: commentBody
    })

    // if (createComment) { then create a comment on the PR with the results of the actions }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) setFailed(error.message)
  }
}
