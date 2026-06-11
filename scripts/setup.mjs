import { spawnSync } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const root = process.cwd();
const modelPath = path.join(root, "data", "models", "ggml-tiny.en.bin");
const modelUrl =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin?download=true";
const envPath = path.join(root, ".env");

await main();

async function main() {
  console.log("Reel Notes setup\n");
  run("npm", ["install"]);
  run("npx", ["playwright", "install", "chromium"]);
  check("ffmpeg", ["-version"], "Install ffmpeg and make sure it is on PATH.");
  checkYtDlp();

  if (!fs.existsSync(envPath) && fs.existsSync(path.join(root, ".env.example"))) {
    fs.copyFileSync(path.join(root, ".env.example"), envPath);
    console.log("OK created .env from .env.example");
  }

  if (process.argv.includes("--with-local-whisper")) {
    await downloadModel();
    updateEnv({
      TRANSCRIPTION_PROVIDER: "local",
      LOCAL_WHISPER_MODEL: "data/models/ggml-tiny.en.bin"
    });
  } else {
    await configureModels();
  }

  console.log("\nSetup finished. Run npm run doctor next.");
}

function run(command, args) {
  const result =
    process.platform === "win32"
      ? spawnSync(commandForShell(command, args), { stdio: "inherit", shell: true })
      : spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function check(command, args, help) {
  const result =
    process.platform === "win32"
      ? spawnSync(commandForShell(command, args), { encoding: "utf8", shell: true })
      : spawnSync(command, args, { encoding: "utf8" });
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
    const result =
      process.platform === "win32"
        ? spawnSync(commandForShell(command, args), { encoding: "utf8", shell: true })
        : spawnSync(command, args, { encoding: "utf8" });
    if (result.status === 0) {
      console.log(`OK yt-dlp: ${command} ${args.join(" ")}`);
      return;
    }
  }

  console.log("MISSING yt-dlp: install with python -m pip install -U yt-dlp");
}

function commandForShell(command, args) {
  return [command, ...args].map((part) => (part.includes(" ") ? `"${part.replaceAll('"', '\\"')}"` : part)).join(" ");
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

async function configureModels() {
  const env = readEnv();
  const hasOpenAiKey = Boolean(env.OPENAI_API_KEY?.trim());
  const hasLocalModel = fs.existsSync(path.resolve(env.LOCAL_WHISPER_MODEL || modelPath));

  if (hasOpenAiKey || hasLocalModel) {
    console.log("OK model configuration found.");
    return;
  }

  if (!process.stdin.isTTY || process.env.CI === "true") {
    console.log(
      "SKIP model prompt. Add OPENAI_API_KEY to .env or run npm run setup -- --with-local-whisper to download the default local model."
    );
    return;
  }

  const rl = readline.createInterface({ input, output });
  try {
    console.log("\nNo local Whisper model or OpenAI API key was found.");
    console.log("Choose a model path:");
    console.log("1. Download default local Whisper model");
    console.log("2. Use OpenAI API");
    console.log("3. Skip for now");
    const choice = (await rl.question("Select 1, 2, or 3: ")).trim();

    if (choice === "1") {
      await downloadModel();
      updateEnv({
        TRANSCRIPTION_PROVIDER: "local",
        SUMMARY_PROVIDER: env.SUMMARY_PROVIDER || "openai",
        LOCAL_WHISPER_MODEL: "data/models/ggml-tiny.en.bin"
      });
      return;
    }

    if (choice === "2") {
      const apiKey = (await rl.question("OpenAI API key, leave blank to set later: ")).trim();
      const transcriptionModel =
        (await rl.question("Transcription model [gpt-4o-mini-transcribe]: ")).trim() || "gpt-4o-mini-transcribe";
      const enrichmentModel = (await rl.question("Enrichment model [gpt-4.1-mini]: ")).trim() || "gpt-4.1-mini";
      updateEnv({
        TRANSCRIPTION_PROVIDER: "openai",
        SUMMARY_PROVIDER: "openai",
        OPENAI_API_KEY: apiKey,
        OPENAI_TRANSCRIPTION_MODEL: transcriptionModel,
        OPENAI_SUMMARY_MODEL: enrichmentModel
      });
      return;
    }

    console.log("Skipped model setup. You can edit .env later.");
  } finally {
    rl.close();
  }
}

function readEnv() {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const values = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }

  return values;
}

function updateEnv(updates) {
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const seen = new Set();
  const next = existing.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      return line;
    }

    const key = trimmed.slice(0, trimmed.indexOf("="));
    if (!Object.prototype.hasOwnProperty.call(updates, key)) {
      return line;
    }

    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      next.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(envPath, `${next.join("\n").replace(/\n+$/g, "")}\n`);
  console.log("OK updated .env model settings");
}
