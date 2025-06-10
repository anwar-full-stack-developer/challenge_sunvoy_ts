import nodeFetch from "node-fetch";
import fetchCookie from "fetch-cookie";
const fetch = fetchCookie(nodeFetch);
import fs from "fs";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";
import puppeteer from "puppeteer";
import crypto from "crypto";

const LOGIN_URL = "https://challenge.sunvoy.com/login";
const USER_LIST_URL = "https://challenge.sunvoy.com/list";
const USER_PROFILE_URL = "https://challenge.sunvoy.com/settings";
const JSON_FILE_PATH = "users.json";

const USERNAME = "demo@example.org";
const PASSWORD = "test";

function urlSearchParamsToJSON(params: URLSearchParams): Record<any, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of params.entries()) {
    const existing = result[key];
    result[key] = existing === undefined 
      ? value 
      : Array.isArray(existing) 
        ? [...existing, value] 
        : [existing, value];
  }

  return result;
}

async function getLoggedinUserData(cookieHeader:any) {
  const e = Math.floor(Date.now() / 1e3);

  const tokenPage = await fetch(
    "https://challenge.sunvoy.com/settings/tokens",
    {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
      },
      // credentials: "include", // Include credentials
    }
  );
  var tokenPageHtml = await tokenPage.text();

  const $ = cheerio.load(tokenPageHtml);
  const form = $("body");
  const formData = new URLSearchParams();

  // Extract all hidden input fields
  form.find("input[type=hidden]").each((_, el) => {
    const name = $(el).attr("id");
    const value = $(el).attr("value") || '';
    // console.log(name, value);
    if (name) formData.append(name, value);
  });

  const timestamp = Math.floor(Date.now() / 1000).toString(); // Unix timestamp in seconds

  formData.append("timestamp", timestamp);

  const params: Record<string, any>  = urlSearchParamsToJSON(formData);
  const strToSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");

  const secret = "mys3cr3t";

  const checkcode = crypto
    .createHmac("sha1", secret)
    .update(strToSign)
    .digest("hex");

  // Step 4: Append timestamp and checkcode
  formData.append("checkcode", checkcode.toUpperCase());

  // console.log("tokens: ", formData.toString());

  const loggedInUserInfo = await fetch(
    "https://api.challenge.sunvoy.com/api/settings",
    {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },

      body: formData.toString(),
      // credentials: "include", // Include credentials
    }
  );
  var loggedInUser = await loggedInUserInfo.json();
  console.log("loggedin user info", loggedInUser);

  //update loggedin user info to json file
  let jsonData = fs.readFileSync(JSON_FILE_PATH, "utf-8");
  let exdata = JSON.parse(jsonData);
  exdata.loggedInUser = loggedInUser;
  const updatedJson = JSON.stringify(exdata, null, 2);
  fs.writeFileSync(JSON_FILE_PATH, updatedJson);
  console.log("Loggedin user info writen to users.json file");
  return loggedInUser;
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

  //   // verify authentication via a protected page
  // const dashboardRes = await fetch("https://challenge.sunvoy.com/list", {
  //   method: "GET",
  //   headers: {
  //     Cookie: cookieHeader,
  //   },
  // });
  // const dashHtml = await dashboardRes.text();
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
  await getLoggedinUserData(cookieHeader);
}

loginViaForm().catch(console.error);