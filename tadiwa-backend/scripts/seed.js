/**
 * Bootstraps the first user(s) directly via Prisma, bypassing the API.
 *
 * Necessary because POST /api/users is ADMIN-gated — with an empty users
 * table there is otherwise no way to create the first account at all.
 * Safe to re-run: an existing email is left untouched (password included),
 * never overwritten.
 *
 * Usage: npm run seed
 */
import 'dotenv/config';
import { prisma } from '../lib/prismaClient.js';
import { hashPassword } from '../utils/hash.js';

const SEED_USERS = [
  { email: 'admin@tadiwa.local', password: 'ChangeMe123!', fullName: 'Tadiwa Admin', role: 'ADMIN' },
];

async function main() {
  for (const u of SEED_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`Already exists, left untouched: ${existing.email} (${existing.role})`);
      continue;
    }
    const passwordHash = await hashPassword(u.password);
    const user = await prisma.user.create({
      data: { email: u.email, passwordHash, fullName: u.fullName, role: u.role },
    });
    console.log(`Created: ${user.email} (${user.role})`);
  }

  console.log('\nLog in with:');
  for (const u of SEED_USERS) console.log(`  ${u.email} / ${u.password}`);
  console.log('\nChange this password (or seed a real one) before using this anywhere but local dev.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
