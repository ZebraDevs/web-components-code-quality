# web-components-code-quality

This action is designed to format and test Web Component repositories on pull requests. It helps ensure that your code meets the required quality standards.

### Dependencies

- custom-elements-manifest
- eslint
- lit-analyzer
- prettier
- playwright
- web-test-runner
- @web/test-runner-junit-reporter
- typedoc

### Usage

Follow the instructions below to integrate this action into your workflow.

```yml
name: CI - Pull Request

on:
  pull_request:
    branches:
      - main

permissions:
  contents: write
  issues: write

jobs:
  code-quality:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Branch
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Code Quality
        uses: ZebraDevs/web-components-code-quality@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          working-directory: .
          web-components-src: src/**/*.ts
          test-src: src/test/**/*.test.ts
          test-results-path: ./test-results.xml
          coverage-path: coverage/lcov.info
          run-static-analysis: true
          run-code-formatting: true
          run-tests: true
          run-coverage: true
          create-comment: true
          coverage-pass-score: 80
```

### Config

Ensure a report for web test runner.

web-test-runner.config.js

```js
///.....
import { defaultReporter } from "@web/test-runner";
import { junitReporter } from "@web/test-runner-junit-reporter";

export default {
  ///.....
  reporters: [
    defaultReporter({ reportTestResults: false, reportTestProgress: true }),
    junitReporter({
      outputPath: "src/test/test-results.xml",
      reportLogs: true,
    }),
  ],
};
```

## Inputs

| Name                | Description                                                         | Required | Default                                                               |
| ------------------- | ------------------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| token               | Token used for pushing fixes and commenting on PRs.                 | true     |                                                                       |
| working-directory   | Working directory to run the action in                              | false    | "."                                                                   |
| web-components-src  | The path to the directory containing the web components source code | false    | "src/\*_/_.{ts,tsx}"                                                  |
| test-src            | The path to the directory containing the test source code           | false    | "src/test/\*_/_.test.ts"                                              |
| test-results-path   | The path to the test results file                                   | false    | "./test-results.xml"                                                  |
| coverage-path       | The path to the coverage file                                       | false    | "coverage/lcov.info"                                                  |
| run-static-analysis | Whether to run static analysis                                      | false    | true                                                                  |
| run-code-formatting | Whether to run code formatting                                      | false    | true                                                                  |
| run-tests           | Whether tests should be run.                                        | false    | true                                                                  |
| run-coverage        | Whether to run coverage                                             | false    | true                                                                  |
| create-comment      | Whether to create a comment on the PR                               | false    | true                                                                  |
| coverage-pass-score | The minimum coverage score required to pass                         | false    | "80"                                                                  |
| eslint-config-path  | The path to the ESLint configuration file                           | false    | "eslint.config.\*"                                                    |
| test-config-path    | The path to the test configuration file                             | false    | "web-test-runner.config.\*"                                           |
| eslint-cmd          | Override command used for eslint                                    | false    | "npx eslint -f unix $web-components-src --config $eslint-config-path" |
| lit-analyzer-cmd    | Override command used for lit analyzer                              | false    | npx lit-analyzer --quiet --format markdown                            |
