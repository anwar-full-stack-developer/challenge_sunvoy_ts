const fs = require("fs");
const puppeteer = require("puppeteer");

const LOGIN_URL = "https://challenge.sunvoy.com/login";
const USER_LIST_URL = "https://challenge.sunvoy.com/list";
const USER_PROFILE_URL = "https://challenge.sunvoy.com/settings";
const JSON_FILE_PATH = "users.json";

const USERNAME = "demo@example.org";
const PASSWORD = "test";

async function scrapeSunvoy() {
  var browser = await puppeteer.launch({ headless: false });
  var page = await browser.newPage();
  await page.setRequestInterception(true);
  page.setDefaultNavigationTimeout(0);

  page.on("request", (request: any) => {
    if (request.resourceType() === "xhr") {
      console.log("AJAX request:", request.url());
    }
    request.continue();
  });
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

  // Step 1: Fill in and submit the login form
  await page.type('[name="username"]', USERNAME);
  await page.type('[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "domcontentloaded" }); // wait for redirect after login

  // Step 2: Go to User List Page
  var content = await page.goto(USER_LIST_URL);

  const response = await page.waitForResponse(
    (res: any) => res.url().includes("/api/users") && res.status() === 200
  );
  const userListjson = await response.json();
  console.log(userListjson);
  // Convert to pretty-printed JSON (4-space indentation)
  const jsonString = JSON.stringify({ users: userListjson }, null, 4);

  await content.text();

  // Write to file
  fs.writeFile(JSON_FILE_PATH, jsonString, (err: any) => {
    if (err) {
      console.error("Error writing file:", err);
    } else {
      console.log("JSON written to users.json");
    }
  });

  // monitor AJAX requests directly:
  page.on("response", async (response:any) => {
    // console.log(response.url());
    if (response.url().includes("/api/settings") && response.status() === 200) {
      const data = await response.json();
      console.log("AJAX response Api settings:", data);

      // Step 1: Read the file
      let jsonData = fs.readFileSync(JSON_FILE_PATH, "utf-8");

      // Step 2: Parse JSON into a JS object
      let exdata = JSON.parse(jsonData);
      exdata.loggedInUser = data;
      const updatedJson = JSON.stringify(exdata, null, 2);
      fs.writeFileSync(JSON_FILE_PATH, updatedJson);
    }
  });

  // scraping User Settings
  const settingsPage = await page.goto(USER_PROFILE_URL, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("#settingsContent form", { timeout: 10000 });

  const pageContent = await page.content();
  // console.log(pageContent);

  await browser.close();
}

scrapeSunvoy();
