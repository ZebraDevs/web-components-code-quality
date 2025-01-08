import { setFailed } from "@actions/core";
import * as fs from "fs";
import {
  failedEmoji,
  passedEmoji,
  coverageDown,
  coverageUp,
  StepResponse,
} from "src/main";
import parseLCOV, { LCOVRecord } from "parse-lcov";

const loadCoverageData = (coveragePath: string): LCOVRecord[] | undefined => {
  let coverageData: LCOVRecord[] | undefined;
  try {
    const lcov = fs.readFileSync(coveragePath, "utf8");
    coverageData = parseLCOV(lcov);
  } catch (error) {
    setFailed(`Failed to read coverage file: ${error as string}`);
  }
  return coverageData;
};

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
      response.output = `${failedEmoji} - Coverage below ${coveragePassScore}%: Current ${currentCoverageScore}%\n<details><summary>See Details</summary>${coverageTable}</details>`;
    } else {
      if (pastCoverageScore === currentCoverageScore) {
        response.output = `${passedEmoji} - Coverage: ${currentCoverageScore}%\n<details><summary>See Details</summary>${coverageTable}</details>`;
      } else if (pastCoverageScore > currentCoverageScore) {
        response.output = `${coverageDown} - Coverage: from ${pastCoverageScore}% to ${currentCoverageScore}%\n<details><summary>See Details</summary>${coverageTable}</details>`;
      } else if (pastCoverageScore < currentCoverageScore) {
        response.output = `${coverageUp} - Coverage: from ${pastCoverageScore}% to ${currentCoverageScore}%\n<details><summary>See Details</summary>${coverageTable}</details>`;
      }
    }
  }

  return response;
};

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
