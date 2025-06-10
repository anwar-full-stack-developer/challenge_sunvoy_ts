import nodeFetch from "node-fetch";
import fetchCookie from "fetch-cookie";
const fetch = fetchCookie(nodeFetch);
import fs from "fs";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";
import puppeteer from "puppeteer";

const LOGIN_URL = "https://challenge.sunvoy.com/login";
const USER_LIST_URL = "https://challenge.sunvoy.com/list";
const USER_PROFILE_URL = "https://challenge.sunvoy.com/settings";
const JSON_FILE_PATH = "users.json";

const USERNAME = "demo@example.org";
const PASSWORD = "test";

async function getSettingsPageData() {
  const browser = await puppeteer.launch({
    headless: false, // set to false to watch the browser in action
    // args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  var page = await browser.newPage();
  await page.setRequestInterception(true);
  // page.setDefaultNavigationTimeout(0);
  page.on("request", (request) => {
    if (request.resourceType() === "xhr") {
      console.log("AJAX request:", request.url());
    }
    request.continue();
  });
  await page.goto(LOGIN_URL);

  // Step 1: Fill in and submit the login form
  await page.type('[name="username"]', USERNAME);
  await page.type('[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({
    waitUntil: "domcontentloaded",
  }); // wait for redirect after login

  await page.click(".mt-6 > a");

  // monitor AJAX requests directly:
  page.on("response", async (response) => {
    // console.log(response.url());
    if (response.url().includes("/api/settings") && response.status() === 200) {
      const data = await response.json();
      console.log("AJAX response Api settings:", data);

      let jsonData = fs.readFileSync(JSON_FILE_PATH, "utf-8");

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
  //   console.log(pageContent);

  await browser.close();
}

async function loginViaForm() {

  // GET login page to retrieve hidden fields
  const getRes = await fetch(LOGIN_URL);
  const html = await getRes.text();

  const $ = cheerio.load(html);
  const form = $("form");
  const formData = new URLSearchParams();

  // Extract all hidden input fields
  form.find("input[type=hidden]").each((_, el) => {
    const name = $(el).attr("name");
    const value = $(el).attr("value") || '';
    if (name) formData.append(name, value);
  });

  // Add credentials
  formData.append("username", USERNAME);
  formData.append("password", PASSWORD);


  console.log("Form data", formData.toString());
  const postRes = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
    redirect: "manual",
  });
  const cookieHeader = postRes.headers.get("set-cookie") || "";
  console.log(`POST response status: ${postRes.status}`);
  if ([301, 302].includes(postRes.status)) {
    console.log("Redirecting to:", postRes.headers.get("location"));
  }
  const postBody = await postRes.text();

  console.log("Login response: ", postBody);

  //   // Step 3: verify authentication via a protected page
  const dashboardRes = await fetch("https://challenge.sunvoy.com/list", {
    method: "GET",
    headers: {
      Cookie: cookieHeader,
    },
  });
  const dashHtml = await dashboardRes.text();
  //   console.log(dashHtml);
  // console.log("Dashboard snippet:", dashHtml.slice(0, 500));

  const userListRes = await fetch("https://challenge.sunvoy.com/api/users", {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
    },
    // credentials: "include", // Include credentials
  });
  var userList = await userListRes.json();
  console.log("User List", userList);

  // Write to file
  const jsonString = JSON.stringify({ users: userList }, null, 4);
  fs.writeFile(JSON_FILE_PATH, jsonString, (err) => {
    if (err) {
      console.error("Error writing file:", err);
    } else {
      console.log("JSON written to users.json");
    }
  });
  
  //get current loggedin user
  await getSettingsPageData();
}

loginViaForm().catch(console.error);