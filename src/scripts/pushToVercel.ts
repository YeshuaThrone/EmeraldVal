import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function pushToVercel(): void {
  console.log("🚀 Pushing WURFI directly to Vercel...");
  try {
    execSync("npx vercel --prod --force --yes", { stdio: "inherit" });
    console.log("✅ WURFI successfully pushed to Vercel!");
  } catch (error) {
    console.error("❌ Vercel push failed:", error);
  }
}

function isDirectRun(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return import.meta.url === pathToFileURL(invoked).href;
  } catch {
    return /pushToVercel\.(ts|js)$/.test(invoked);
  }
}

if (isDirectRun()) {
  pushToVercel();
}
