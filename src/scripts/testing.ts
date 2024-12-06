import { exec } from '@actions/exec'
import { setFailed } from '@actions/core'
import { stepResponse } from 'src/main'

export const testing = async (): Promise<stepResponse> => {
  try {
    // Run tests and generate coverage
    await exec('npm run test -- --coverage --debug')

    // Test tsdoc
    await exec('npm run docs')

    return { output: 'Testing complete', error: false }
  } catch (error) {
    if (error instanceof Error) setFailed(error.message)
    return { output: 'Testing failed', error: true }
  }
}
