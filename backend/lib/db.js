// Prisma client singleton.
//
// Why a singleton: every file that needs the DB does `require('../lib/db')`
// instead of `new PrismaClient()`. Prisma opens a connection pool per
// instance — if every route/script made its own client, we'd leak
// connections (Express hot-reloads, scripts run one-off, etc). One shared
// instance means one pool for the whole process.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

module.exports = prisma;
