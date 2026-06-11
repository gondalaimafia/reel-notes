import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const skippedDirs = new Set([".git", "node_modules", "dist"]);
const blockedDirs = new Set(["data", "notes"]);
const blockedFiles = new Set([".env", "credentials.json"]);
const blockedPatterns = [
  /C:\\Users\\[^\\]+\\OneDrive/i,
  /C:\\Users\\[^\\]+\\Desktop/i,
  /OPENAI_API_KEY\s*=\s*(sk|sess)-[A-Za-z0-9_-]{16,}/i,
  /INSTAGRAM_PASSWORD\s*=/i,
  /password"\s*:/i,
  /access_token"\s*:/i,
  /refresh_token"\s*:/i
];

const findings = [];

walk(root);

if (findings.length > 0) {
  console.error("Sanitization failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Sanitization passed.");

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(root, fullPath) || entry.name;

    if (entry.isDirectory()) {
      if (skippedDirs.has(entry.name)) {
        continue;
      }

      if (blockedDirs.has(entry.name)) {
        findings.push(`blocked directory present: ${relativePath}`);
        continue;
      }

      walk(fullPath);
      continue;
    }

    if (blockedFiles.has(entry.name)) {
      findings.push(`blocked file present: ${relativePath}`);
      continue;
    }

    if (!isTextFile(entry.name)) {
      continue;
    }

    const text = fs.readFileSync(fullPath, "utf8");
    for (const pattern of blockedPatterns) {
      if (pattern.test(text)) {
        findings.push(`blocked content in ${relativePath}: ${pattern}`);
      }
    }
  }
}

function isTextFile(fileName) {
  return /\.(ts|js|mjs|json|md|txt|yml|yaml|example|gitignore|ps1|sh)$/i.test(fileName) || fileName === "LICENSE";
}
