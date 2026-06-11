import path from "node:path";

export const projectRoot = process.cwd();
export const dataDir = path.join(projectRoot, "data");
export const logsDir = path.join(dataDir, "logs");
export const mediaDir = path.join(dataDir, "media");
export const indexPath = path.join(dataDir, "reels-index.json");
