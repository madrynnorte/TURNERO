// Run explicitly against the configured production D1. Passwords exist only in
// memory and are printed once for private delivery to the owner.
import { randomBytes, pbkdf2Sync } from "node:crypto";
import { spawnSync } from "node:child_process";

function execute(sql) {
  const result = spawnSync(
    process.execPath,
    [
      "--use-system-ca",
      "node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "madryn-norte-turnos",
      "--remote",
      "--config",
      "wrangler.production.jsonc",
      "--json",
      "--command",
      sql,
    ],
    { encoding: "utf8", timeout: 60000 },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || "No se pudo actualizar el equipo");
  return JSON.parse(result.stdout);
}
const names = [
  ["javier", "Javier"],
  ["yani", "Yani"],
  ["ezequiel", "Ezequiel"],
];
const existing = execute(
  "SELECT username FROM users WHERE username IN ('javier','yani','ezequiel');",
)[0].results;
if (existing.length)
  throw new Error(
    "Ya existen cuentas del equipo. No se modificaron contraseñas.",
  );
const accounts = names.map(([username, displayName]) => {
  const password = `MN-${randomBytes(9).toString("base64url")}-Aa9!`;
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 100000, 32, "sha256").toString(
    "base64",
  );
  return {
    username,
    displayName,
    password,
    salt: salt.toString("base64"),
    hash,
  };
});
for (const account of accounts)
  execute(
    `INSERT INTO users(id,username,display_name,password_hash,password_salt,role,active,must_change_password) VALUES ('user-${account.username}','${account.username}','${account.displayName}','${account.hash}','${account.salt}','administrador',1,1);`,
  );
// Verify real sign-in. Existing accounts and their sessions remain untouched.
for (const account of accounts) {
  const response = await fetch(
    "https://madryn-norte-turnos.madryn-norte-cd.workers.dev/api/auth/login",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: account.username,
        password: account.password,
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      `No se pudo verificar el acceso de ${account.username}. Las cuentas antiguas siguen activas.`,
    );
}
execute(
  "INSERT OR IGNORE INTO staff(id,name,active) VALUES ('staff-yani','Yani',1),('staff-nico','Nico',1),('staff-lucas','Lucas',1); UPDATE staff SET active=0 WHERE id IN ('staff-maria','staff-lucia','staff-tomas'); UPDATE staff SET active=1 WHERE id IN ('staff-yani','staff-nico','staff-juan','staff-lucas');",
);
console.log(
  JSON.stringify(
    {
      accounts: accounts.map(({ username, displayName, password }) => ({
        username,
        displayName,
        password,
      })),
      verified: true,
    },
    null,
    2,
  ),
);
