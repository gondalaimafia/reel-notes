import { spawnSync } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const root = process.cwd();
const modelPath = path.join(root, "data", "models", "ggml-tiny.en.bin");
const modelUrl =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin?download=true";

await main();

async function main() {
  console.log("Reel Notes setup\n");
  run("npm", ["install"]);
  run("npx", ["playwright", "install", "chromium"]);
  check("ffmpeg", ["-version"], "Install ffmpeg and make sure it is on PATH.");
  checkYtDlp();

  if (process.argv.includes("--with-local-whisper")) {
    await downloadModel();
  } else {
    console.log("SKIP local Whisper model download. Run npm run setup -- --with-local-whisper to add it.");
  }

  if (!fs.existsSync(path.join(root, ".env")) && fs.existsSync(path.join(root, ".env.example"))) {
    fs.copyFileSync(path.join(root, ".env.example"), path.join(root, ".env"));
    console.log("OK created .env from .env.example");
  }

  console.log("\nSetup finished. Run npm run doctor next.");
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function check(command, args, help) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32" });
  if (result.status === 0) {
    const version = `${result.stdout || ""}${result.stderr || ""}`.split(/\r?\n/).find(Boolean)?.trim() || "installed";
    console.log(`OK ${command}: ${version}`);
    return;
  }

  console.log(`MISSING ${command}: ${help}`);
}

function checkYtDlp() {
  const candidates =
    process.platform === "win32"
      ? [
          ["py", ["-m", "yt_dlp", "--version"]],
          ["python", ["-m", "yt_dlp", "--version"]],
          ["yt-dlp", ["--version"]]
        ]
      : [
          ["python3", ["-m", "yt_dlp", "--version"]],
          ["python", ["-m", "yt_dlp", "--version"]],
          ["yt-dlp", ["--version"]]
        ];

  for (const [command, args] of candidates) {
    const result = spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32" });
    if (result.status === 0) {
      console.log(`OK yt-dlp: ${command} ${args.join(" ")}`);
      return;
    }
  }

  console.log("MISSING yt-dlp: install with python -m pip install -U yt-dlp");
}

function downloadModel() {
  if (fs.existsSync(modelPath)) {
    console.log(`OK local Whisper model exists: ${modelPath}`);
    return Promise.resolve();
  }

  fs.mkdirSync(path.dirname(modelPath), { recursive: true });
  console.log(`Downloading local Whisper tiny English model to ${modelPath}`);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(modelPath);
    const request = https.get(modelUrl, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        https
          .get(response.headers.location, (redirect) => {
            redirect.pipe(file);
            redirect.on("end", resolve);
          })
          .on("error", reject);
        return;
      }

      response.pipe(file);
      response.on("end", resolve);
    });

    request.on("error", (error) => {
      fs.rmSync(modelPath, { force: true });
      reject(error);
    });
  });
}
