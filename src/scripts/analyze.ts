import { exec } from '@actions/exec'
import { setFailed } from '@actions/core'
import { stepResponse } from 'src/main'

export const analyze = async (): Promise<stepResponse> => {
  try {
    // Run custom elements manifest analyzer
    await exec('npm run analyze')

    // Run eslint
    await exec('npm run lint')

    // Run lit-analyzer
    await exec('npm run lint:lit-analyzer')

    return { output: 'Static analysis complete', error: false }
  } catch (error) {
    if (error instanceof Error) setFailed(error.message)
    return { output: 'Static analysis failed', error: true }
  }
}
