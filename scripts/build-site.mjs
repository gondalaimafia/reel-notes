import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const docsDir = path.join(root, "docs");
const siteDir = path.join(root, "site");
const siteUrl = process.env.PUBLIC_SITE_URL || "https://reel-notes-phi.vercel.app";

const source = fs.readFileSync(path.join(docsDir, "index.md"), "utf8");
const { frontmatter, markdown } = parseFrontmatter(source);
const body = renderMarkdown(markdown);
const title = `${frontmatter.seo_title || frontmatter.title} | Reel Notes`;
const canonical = `${siteUrl}/`;
const description = frontmatter.description;
const pageTitle = frontmatter.title;
const keywords = frontmatter.keywords;

fs.rmSync(siteDir, { recursive: true, force: true });
fs.mkdirSync(siteDir, { recursive: true });

fs.writeFileSync(path.join(siteDir, "index.html"), renderPage(), "utf8");
fs.writeFileSync(
  path.join(siteDir, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
  "utf8"
);
fs.writeFileSync(
  path.join(siteDir, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>2026-06-12</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`,
  "utf8"
);

console.log(`Built site at ${path.relative(root, siteDir)}`);

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Missing frontmatter");
  }

  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    frontmatter[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }

  return { frontmatter, markdown: match[2].trim() };
}

function renderMarkdown(markdownText) {
  const lines = markdownText.split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let list = null;
  let code = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) {
      return;
    }
    html.push(`<${list.type}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };

  for (const line of lines) {
    const codeFence = line.match(/^```(\w+)?\s*$/);
    if (codeFence && !code) {
      flushParagraph();
      flushList();
      code = { lang: codeFence[1] || "", lines: [] };
      continue;
    }

    if (codeFence && code) {
      html.push(`<pre><code${code.lang ? ` class="language-${escapeHtml(code.lang)}"` : ""}>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
      code = null;
      continue;
    }

    if (code) {
      code.lines.push(line);
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^-\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(numbered[1]);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  if (code) {
    throw new Error("Unclosed code fence");
  }

  return html.join("\n");
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": `${canonical}#article`,
        headline: pageTitle,
        description,
        author: {
          "@type": "Organization",
          name: "Reel Notes contributors"
        },
        publisher: {
          "@type": "Organization",
          name: "Reel Notes"
        },
        mainEntityOfPage: canonical,
        about: [
          "Instagram reels transcription",
          "Obsidian notes",
          "Markdown knowledge management",
          "Local Whisper transcription"
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${canonical}#software`,
        name: "Reel Notes",
        applicationCategory: "ProductivityApplication",
        operatingSystem: "Windows, macOS, Linux",
        softwareVersion: "0.1.0",
        license: "https://github.com/gondalaimafia/reel-notes/blob/main/LICENSE",
        codeRepository: "https://github.com/gondalaimafia/reel-notes",
        downloadUrl: "https://github.com/gondalaimafia/reel-notes/releases/tag/v0.1.0",
        description
      },
      {
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "Is Reel Notes an Obsidian plugin?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "The first version is a command line tool that writes Obsidian ready Markdown into any vault folder."
            }
          },
          {
            "@type": "Question",
            name: "Does Reel Notes need my Instagram password?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. You log in manually in a browser profile that you control, and Reel Notes reuses that browser session."
            }
          },
          {
            "@type": "Question",
            name: "Can Reel Notes run without an OpenAI API key?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. Transcription can use a local Whisper model. LLM enrichment needs a model provider for topic filenames, key lessons, and cleaned notes."
            }
          }
        ]
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Reel Notes",
            item: canonical
          }
        ]
      }
    ]
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests; block-all-mixed-content">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
    <meta name="theme-color" content="#f7f7f4" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#101412" media="(prefers-color-scheme: dark)">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="keywords" content="${escapeHtml(keywords)}">
    <meta name="author" content="Reel Notes contributors">
    <link rel="canonical" href="${canonical}">
    <meta property="og:title" content="${escapeHtml(pageTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${canonical}">
    <meta property="og:site_name" content="Reel Notes">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #f7f7f4;
        --fg: #1f2421;
        --muted: #58615c;
        --link: #155eef;
        --border: #d8ddd8;
        --code: #ecefeb;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #101412;
          --fg: #edf1ed;
          --muted: #a6aea8;
          --link: #8bb4ff;
          --border: #303832;
          --code: #1b211d;
        }
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--fg);
        font: 18px/1.6 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      main {
        max-width: 820px;
        margin: 0 auto;
        padding: 56px 24px 80px;
      }

      h1 {
        font-size: clamp(2.2rem, 6vw, 4.25rem);
        line-height: 1.02;
        margin: 0 0 24px;
        letter-spacing: 0;
      }

      h2 {
        font-size: 1.55rem;
        margin-top: 48px;
        line-height: 1.2;
      }

      p,
      li {
        color: var(--fg);
      }

      a {
        color: var(--link);
      }

      code,
      pre {
        background: var(--code);
      }

      code {
        padding: 0.1rem 0.25rem;
        border-radius: 4px;
      }

      pre {
        overflow-x: auto;
        padding: 18px;
        border: 1px solid var(--border);
        border-radius: 8px;
      }

      pre code {
        padding: 0;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <main>
${body}
    </main>
  </body>
</html>
`;
}
