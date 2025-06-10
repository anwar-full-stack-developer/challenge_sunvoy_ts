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

}

loginViaForm().catch(console.error);