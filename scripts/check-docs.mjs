import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const docsDir = path.join(root, "docs");
const checks = [];

const files = [
  "index.md",
  "_config.yml",
  "_layouts/default.html",
  "robots.txt",
  "sitemap.xml"
];

for (const file of files) {
  const fullPath = path.join(docsDir, file);
  checks.push([fs.existsSync(fullPath), `${file} exists`]);
}

const index = read("index.md");
const config = read("_config.yml");
const layout = read("_layouts/default.html");
const robots = read("robots.txt");
const sitemap = read("sitemap.xml");

checks.push([config.includes("url: https://gondalaimafia.github.io"), "site URL uses HTTPS"]);
checks.push([config.includes("baseurl: /reel-notes"), "site base URL is set"]);
checks.push([layout.includes("Content-Security-Policy"), "layout defines a CSP"]);
checks.push([layout.includes("upgrade-insecure-requests"), "CSP upgrades insecure requests"]);
checks.push([layout.includes("block-all-mixed-content"), "CSP blocks mixed content"]);
checks.push([layout.includes('rel="canonical"'), "layout defines canonical URLs"]);
checks.push([layout.includes('"@type": "TechArticle"'), "layout includes TechArticle schema"]);
checks.push([layout.includes('"@type": "SoftwareApplication"'), "layout includes SoftwareApplication schema"]);
checks.push([layout.includes('"@type": "FAQPage"'), "layout includes FAQPage schema"]);
checks.push([layout.includes('"@type": "BreadcrumbList"'), "layout includes BreadcrumbList schema"]);
checks.push([index.includes("## Quick Answer"), "article has a quick answer section"]);
checks.push([index.includes("## FAQ"), "article has FAQ content"]);
checks.push([index.includes("Instagram reels into Obsidian notes"), "article targets primary search intent"]);
checks.push([robots.includes("Sitemap: https://gondalaimafia.github.io/reel-notes/sitemap.xml"), "robots links HTTPS sitemap"]);
checks.push([sitemap.includes("<loc>https://gondalaimafia.github.io/reel-notes/</loc>"), "sitemap uses canonical HTTPS URL"]);
checks.push([sitemap.includes("<lastmod>"), "sitemap includes lastmod"]);

const mixedContentFindings = [
  ["index.md", index],
  ["_config.yml", config],
  ["_layouts/default.html", layout],
  ["robots.txt", robots]
].flatMap(([file, text]) => {
  return [...text.matchAll(/http:\/\//g)].map((match) => `${file}:${match.index}`);
});

checks.push([mixedContentFindings.length === 0, `no mixed content references outside sitemap namespace: ${mixedContentFindings.join(", ")}`]);

const failures = checks.filter(([passed]) => !passed);

if (failures.length > 0) {
  console.error("Docs check failed:");
  for (const [, message] of failures) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log("Docs check passed.");

function read(relativePath) {
  return fs.readFileSync(path.join(docsDir, relativePath), "utf8");
}
