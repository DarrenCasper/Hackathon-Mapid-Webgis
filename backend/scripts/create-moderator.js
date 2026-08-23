// One-time interactive script to create a moderator account. Run this
// yourself whenever you need a new moderator login — nothing in this
// project hardcodes credentials anywhere, they're typed in here and
// hashed before touching the database.
//
// Run standalone: node scripts/create-moderator.js
require("dotenv").config();
const readline = require("readline");
const bcrypt = require("bcrypt");
const prisma = require("../lib/db");

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// Node's readline can mute echoed input for a password prompt, but it's
// a bit fiddly to do cleanly cross-platform — for a script you run once
// yourself, locally, plain visible input is a reasonable tradeoff
// against the complexity of hiding it properly.
async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const email = (await ask(rl, "Email: ")).trim();
  const displayName = (await ask(rl, "Display name: ")).trim();
  const password = (await ask(rl, "Password: ")).trim();
  rl.close();

  if (!email || !displayName || !password) {
    console.error("Email, display name, and password are all required.");
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const password_hash = await bcrypt.hash(password, 10); // 10 rounds — standard bcrypt default, fine for this scale

  try {
    const moderator = await prisma.moderator.create({
      data: { email, display_name: displayName, password_hash },
    });
    console.log(`Created moderator: ${moderator.email} (id: ${moderator.id})`);
  } catch (err) {
    if (err.code === "P2002") {
      console.error(`A moderator with email "${email}" already exists.`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

main()
  .catch((err) => {
    console.error("Failed to create moderator:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
