import fs from "fs";
import lighthouse from "lighthouse";
const chromeLauncher = require("chrome-launcher");
const log = require("lighthouse-logger");
const app = require("express")();
let puppeteer;
let chrome = {};
//#region Launch Lighthouse to audit
const getBrowserPath = async () => {
  let options = {};
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    chrome = require("chrome-aws-lambda");
    puppeteer = require("puppeteer-core");
  } else {
    puppeteer = require("puppeteer");
  }
  //   const browserFetcher = puppeteer.createBrowserFetcher();
  //   const revisions = await browserFetcher.localRevisions();
  //   if (revisions.length <= 0) {
  //     throw new Error("Could not find local browser");
  //   }
  //   const info = await browserFetcher.revisionInfo(revisions[0]);
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    options = {
      args: [...chrome.args, "--hide-scrollbars", "--disable-web-security"],
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    };
  }

  return options.executablePath;
};

function writeResults(page, results, environmentId, projectId) {
  const dirPath = `${process.env.LH_OUTPUT_DIR}/${projectId}/${environmentId}`;
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const resultsPath = getReportFilePath(dirPath, page.name);
  return fs.writeFileSync(resultsPath, results.report, function (err) {
    if (err) {
      return console.log(err);
    }
    console.log(`The report for "${page.name}" was saved at ${resultsPath}`);
  });
}

function getReportFilePath(outputDirectory, pageName) {
  const now = new Date();
  return `${outputDirectory}/${pageName}-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}-${now.getMilliseconds()}.html`;
}

async function launchChromeAndRunLighthouse(page, environmentId, projectId) {
  console.log("Starting the Lighthouse Audit");
  const browserPath = await getBrowserPath();
  console.log("browserPath ", browserPath);
  const logLevel = "info";
  let chrome;
  log.setLevel(logLevel);
  chrome = await chromeLauncher.launch({
    chromePath: browserPath,
    chromeFlags: [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
    logLevel,
  });
  const options = {
    logLevel: "info",
    output: "html",
    onlyCategories: ["performance"],
    port: chrome.port,
  };
  const runnerResult = await lighthouse(page.url, options);
  console.log("runnerResult ", runnerResult);
  writeResults(page, runnerResult, environmentId, projectId);
  await chrome.kill();
}
//#endregion

app.get("/api/lighthouse", async (req, res) => {
  try {
    await launchChromeAndRunLighthouse(
      {
        url: "https://xm-cloud-integration.vercel.app/About",
        name: "about",
      },
      "dev",
      "123"
    );
  } catch (error) {
    console.log(error);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});

module.exports = app;
