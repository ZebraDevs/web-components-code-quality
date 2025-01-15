import * as fs from "fs";
import {
  failedEmoji,
  passedEmoji,
  coverageDown,
  coverageUp,
  StepResponse,
  detailsEmoji,
} from "src/main";
import parseLCOV, { LCOVRecord } from "parse-lcov";

/**
 * Loads and parses LCOV coverage data from the specified file path.
 *
 * @param {string} coveragePath - The file path to the LCOV coverage data.
 * @returns {LCOVRecord[] | undefined} An array of LCOVRecord objects if the file is successfully read and parsed, otherwise undefined.
 */
const loadCoverageData = (coveragePath: string): LCOVRecord[] | undefined => {
  let coverageData: LCOVRecord[] | undefined;
  try {
    const lcov = fs.readFileSync(coveragePath, "utf8");
    coverageData = parseLCOV(lcov);
  } catch (error) {
    coverageData = undefined;
  }
  return coverageData;
};

/**
 * Calculates the code coverage percentage from the given coverage data file.
 *
 * @param {string} coveragePath - The path to the coverage data file.
 * @returns {number} The code coverage percentage, rounded to two decimal places.
 */
export const getCoverage = (coveragePath: string): number => {
  let coverage = 0;
  let coverageData = loadCoverageData(coveragePath);

  if (coverageData) {
    let linesFound = 0;
    coverageData.forEach((file) => {
      linesFound += file.lines.found;
    });

    let linesHit = 0;
    coverageData.forEach((file) => {
      linesHit += file.lines.hit;
    });

    coverage = linesHit / linesFound;
  }

  return Number((coverage * 100).toFixed(2));
};

/**
 * Calculates and returns the coverage analysis result based on past and current coverage scores.
 *
 * @param {number | undefined} pastCoverageScore - The coverage score from the previous run. Can be undefined.
 * @param {number | undefined} currentCoverageScore - The coverage score from the current run. Can be undefined.
 * @param {string} coveragePassScore - The minimum coverage percentage required to pass as a string.
 * @param {string} coveragePath - The file path to the coverage data.
 * @returns {Promise<StepResponse>} A promise that resolves to a `StepResponse` object containing the output message and error status.
 */
export const coverage = async (
  pastCoverageScore: number | undefined,
  currentCoverageScore: number | undefined,
  coveragePassScore: string,
  coveragePath: string,
): Promise<StepResponse> => {
  let response: StepResponse = { output: "", error: false };

  let coverageData = loadCoverageData(coveragePath);
  let coverageTable = coverageDataToTable(coverageData!);

  if (currentCoverageScore !== undefined && pastCoverageScore !== undefined) {
    if (currentCoverageScore < parseInt(coveragePassScore)) {
      response.error = true;
      response.output = `${failedEmoji} Coverage below ${coveragePassScore}%: Current ${currentCoverageScore}%\n<details><summary>&nbsp;${detailsEmoji} See Details</summary>${coverageTable}</details>`;
    } else {
      if (pastCoverageScore === currentCoverageScore) {
        response.output = `${passedEmoji} Coverage: ${currentCoverageScore}%\n<details><summary>&nbsp;${detailsEmoji} See Details</summary>${coverageTable}</details>`;
      } else if (pastCoverageScore > currentCoverageScore) {
        response.output = `${coverageDown} Coverage: from ${pastCoverageScore}% to ${currentCoverageScore}%\n<details><summary>&nbsp;${detailsEmoji} See Details</summary>${coverageTable}</details>`;
      } else if (pastCoverageScore < currentCoverageScore) {
        response.output = `${coverageUp} Coverage: from ${pastCoverageScore}% to ${currentCoverageScore}%\n<details><summary>&nbsp;${detailsEmoji} See Details</summary>${coverageTable}</details>`;
      }
    }
  } else {
    response.error = true;
    response.output = `${failedEmoji} Coverage: No coverage data found`;
  }

  return response;
};

/**
 * Converts an array of LCOVRecord objects into an HTML table string representation.
 *
 * @param {LCOVRecord[]} coverageData - An array of LCOVRecord objects containing coverage data for files.
 * @returns {string} A string representing an HTML table with coverage data for each file.
 *
 * The table includes the following columns:
 * - File: The name of the file.
 * - Lines: The percentage of lines covered and the ratio of hit lines to found lines.
 * - Branches: The percentage of branches covered and the ratio of hit branches to found branches.
 * - Functions: The percentage of functions covered and the ratio of hit functions to found functions.
 */
const coverageDataToTable = (coverageData: LCOVRecord[]): string => {
  let table =
    "<table><tr><th>File</th><th>Lines</th><th></th><th>Branches</th><th></th><th>Functions</th><th></th></tr>";

  coverageData.forEach((file) => {
    const linesFound = file.lines.found;
    const linesHit = file.lines.hit;
    const branchesFound = file.branches.found;
    const branchesHit = file.branches.hit;
    const functionsFound = file.functions.found;
    const functionsHit = file.functions.hit;

    const linesCoverage =
      linesFound == 0 ? 0 : ((linesHit / linesFound) * 100).toFixed(2);
    const branchesCoverage =
      branchesFound == 0 ? 0 : ((branchesHit / branchesFound) * 100).toFixed(2);
    const functionsCoverage =
      functionsFound == 0
        ? 0
        : ((functionsHit / functionsFound) * 100).toFixed(2);

    table += `<tr>
        <td>${file.file}</td>
        <td>${linesCoverage}%</td> <td>${linesHit}/${linesFound}</td>
        <td>${branchesCoverage}%</td> <td>${branchesHit}/${branchesFound}</td>
        <td>${functionsCoverage}%</td> <td>${functionsHit}/${functionsFound}</td>
      </tr>`;
  });

  table += "</table>";
  return table;
};
