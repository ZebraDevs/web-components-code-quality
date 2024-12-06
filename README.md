# flutter-code-quality

This action is designed to format and test Flutter repositories on pull requests. It helps ensure that your code meets the required quality standards.

### Usage

Follow the instructions below to integrate this action into your workflow.

## Inputs

| Name                | Description                                                       | Required | Default |
| ------------------- | ----------------------------------------------------------------- | -------- | ------- |
| token               | Token used for pushing fixes and commenting on PRs.               | true     |         |
| run-tests           | Whether tests should be run.                                      | false    | true    |
| run-analysis        | Whether static analysis should be run.                            | false    | true    |
| run-coverage        | Whether code coverage should be run.                              | false    | true    |
| run-prev-coverage   | Whether code coverage should be compared with the base branch.    | false    | true    |
| run-behind-by       | Whether action should check if HEAD branch is behind base branch. | false    | true    |
| create-comment      | Whether the action should comment the output status.              | false    | true    |
| working-directory   | Working directory to run the action in                            | false    | "."     |
| coverage-pass-score | Coverage passing percentage                                       | false    | "90"    |
