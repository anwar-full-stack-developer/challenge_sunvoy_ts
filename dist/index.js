"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const fetch_cookie_1 = __importDefault(require("fetch-cookie"));
const fetch = (0, fetch_cookie_1.default)(node_fetch_1.default);
const fs_1 = __importDefault(require("fs"));
const cheerio = __importStar(require("cheerio"));
const url_1 = require("url");
const puppeteer_1 = __importDefault(require("puppeteer"));
const LOGIN_URL = "https://challenge.sunvoy.com/login";
const USER_LIST_URL = "https://challenge.sunvoy.com/list";
const USER_PROFILE_URL = "https://challenge.sunvoy.com/settings";
const JSON_FILE_PATH = "users.json";
const USERNAME = "demo@example.org";
const PASSWORD = "test";
async function getSettingsPageData() {
    const browser = await puppeteer_1.default.launch({
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
            let jsonData = fs_1.default.readFileSync(JSON_FILE_PATH, "utf-8");
            let exdata = JSON.parse(jsonData);
            exdata.loggedInUser = data;
            const updatedJson = JSON.stringify(exdata, null, 2);
            fs_1.default.writeFileSync(JSON_FILE_PATH, updatedJson);
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
    const formData = new url_1.URLSearchParams();
    // Extract all hidden input fields
    form.find("input[type=hidden]").each((_, el) => {
        const name = $(el).attr("name");
        const value = $(el).attr("value") || '';
        if (name)
            formData.append(name, value);
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
    fs_1.default.writeFile(JSON_FILE_PATH, jsonString, (err) => {
        if (err) {
            console.error("Error writing file:", err);
        }
        else {
            console.log("JSON written to users.json");
        }
    });
    //get current loggedin user
    await getSettingsPageData();
}
loginViaForm().catch(console.error);
