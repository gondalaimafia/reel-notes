import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";

const config = loadConfig();
const userDataDir = path.resolve(config.chromeUserDataDir);
fs.mkdirSync(userDataDir, { recursive: true });

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const child = spawn(
  chromePath,
  [`--user-data-dir=${userDataDir}`, `--profile-directory=${config.chromeProfileDir}`, config.instagramSavedUrl],
  {
    detached: true,
    stdio: "ignore",
    windowsHide: false
  }
);

child.unref();
console.log(`Opened Chrome automation profile at ${config.instagramSavedUrl}`);
console.log("Log into Instagram in that window, then close it before running the importer.");
