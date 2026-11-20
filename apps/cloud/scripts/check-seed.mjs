import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const initSql = path.join(root, "d1/migrations/0001_init.sql");
const seedSql = path.join(root, "seed/seed.sql");

const SQL = await initSqlJs();
const db = new SQL.Database();

try {
  db.run(fs.readFileSync(initSql, "utf8"));
  db.run(fs.readFileSync(seedSql, "utf8"));

  const tables = [
    "programs",
    "program_versions",
    "skins",
    "skin_screens",
    "videos",
    "stores",
    "devices",
    "pairing_sessions",
  ];

  console.log("Seed validation OK. Row counts:");
  for (const t of tables) {
    const row = db.exec(`SELECT COUNT(*) AS n FROM ${t}`)[0]?.values[0][0] ?? 0;
    console.log(`  ${t}: ${row}`);
  }
} catch (err) {
  console.error("Seed validation FAILED:", err.message);
  process.exit(1);
} finally {
  db.close();
}