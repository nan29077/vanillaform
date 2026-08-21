import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envFiles = [resolve(".env"), resolve(".env.local"), resolve("..", ".env.local")];
const forbidden = [
  "sellerbricks.co.kr",
  "sellerbricks.com",
  "live.sellerbricks.com",
  "reset.czuyyqg40lmv",
  "github.com/yunsell/sellerbricks",
];

const contents = envFiles
  .filter((file) => existsSync(file))
  .map((file) => ({ file, text: readFileSync(file, "utf8") }));

for (const { file, text } of contents) {
  const matched = forbidden.find((value) => text.toLowerCase().includes(value));
  if (matched) {
    console.error(`[바닐라폼 안전 차단] ${file}에 기존 서비스 연결값(${matched})이 남아 있습니다.`);
    process.exit(1);
  }
}

const merged = Object.fromEntries(
  contents
    .flatMap(({ text }) => text.split(/\r?\n/))
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']?(.*?)["']?\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);

const databaseUrl = process.env.VANILLAFORM_DATABASE_URL || merged.VANILLAFORM_DATABASE_URL;
if (!databaseUrl) {
  console.error("[바닐라폼 안전 차단] VANILLAFORM_DATABASE_URL이 없습니다.");
  process.exit(1);
}

let database;
try {
  database = new URL(databaseUrl);
} catch {
  console.error("[바닐라폼 안전 차단] VANILLAFORM_DATABASE_URL 형식이 올바르지 않습니다.");
  process.exit(1);
}

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (!localHosts.has(database.hostname) && process.env.ALLOW_REMOTE_VANILLAFORM_DATABASE !== "true") {
  console.error(
    `[바닐라폼 안전 차단] 원격 DB(${database.hostname})는 기본 차단됩니다. 바닐라폼 전용 DB 확인 후 ALLOW_REMOTE_VANILLAFORM_DATABASE=true를 명시하세요.`,
  );
  process.exit(1);
}

if ((process.env.EXTERNAL_INTEGRATIONS_ENABLED || merged.EXTERNAL_INTEGRATIONS_ENABLED) !== "false") {
  console.error("[바닐라폼 안전 차단] 외부 연동은 초기 분리 단계에서 false여야 합니다.");
  process.exit(1);
}

console.log(`[바닐라폼 안전 확인] DB=${database.hostname}/${database.pathname.replace(/^\//, "")}, 외부 연동=차단`);
