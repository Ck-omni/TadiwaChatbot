/**
 * One-off (and safely re-runnable) backfill: embeds every active
 * knowledge_base_entries row that has no embedding yet.
 *
 * New entries get embedded automatically on create/update (see
 * apps/knowledgeBase/service/knowledgeBase.js) — this is only needed for
 * rows that predate that hook, or that were left NULL because the local
 * LLM was briefly unreachable when they were written.
 *
 * Usage: npm run embed-kb
 */
import 'dotenv/config';
import { prisma } from '../lib/prismaClient.js';
import { embedText, toVectorLiteral } from '../utils/llm.js';

async function main() {
  const pending = await prisma.$queryRaw`
    SELECT id, content FROM knowledge_base_entries
    WHERE is_active AND embedding IS NULL
    ORDER BY id
  `;

  if (pending.length === 0) {
    console.log('Nothing to backfill — every active entry already has an embedding.');
    return;
  }

  console.log(`Embedding ${pending.length} entr${pending.length === 1 ? 'y' : 'ies'}...`);
  let ok = 0;
  for (const row of pending) {
    try {
      const vector = await embedText(row.content);
      await prisma.$executeRaw`
        UPDATE knowledge_base_entries SET embedding = ${toVectorLiteral(vector)}::vector WHERE id = ${row.id}
      `;
      ok++;
      console.log(`  [${ok}/${pending.length}] embedded entry ${row.id}`);
    } catch (e) {
      console.warn(`  entry ${row.id} failed: ${e.message}`);
    }
  }
  console.log(`Done — ${ok}/${pending.length} embedded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
