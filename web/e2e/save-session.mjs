// Run once, by the owner, with a dedicated test Google account: node e2e/save-session.mjs
// A browser window opens. Sign in yourself, then press Enter in this terminal. The session is saved
// outside the repository, and no password is typed or stored by this script.
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import { chromium } from "@playwright/test";

const target = path.join(os.homedir(), ".journal-e2e", "session.json");

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto(process.env.E2E_BASE_URL ?? "https://journal.getrendercheck.com");
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await new Promise((resolve) => rl.question("Sign in, then press Enter here to save the session. ", resolve));
rl.close();
await page.context().storageState({ path: target });
await browser.close();
console.log(`Saved. Run: E2E_STORAGE_STATE=${target} npm run e2e`);
