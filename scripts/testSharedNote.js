#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const r = await prisma.sharedNote.upsert({
    where: { id: 1 },
    update: { ops: 'テストOPS', comm: 'テストCOMM', stoveDate: '2025-08-18' },
    create: { id: 1, ops: 'テストOPS', comm: 'テストCOMM', stoveDate: '2025-08-18' }
  });
  console.log('Upserted:', r);
  const fetched = await prisma.sharedNote.findUnique({ where: { id: 1 } });
  console.log('Fetched:', fetched);
  await prisma.$disconnect();
})();
