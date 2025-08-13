// Assign sequential mgmtCode to existing Staff rows missing it.
// Pattern: start from 300 and increment.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const staff = await prisma.staff.findMany({ orderBy: { id: 'asc' } });
  let code = 300;
  for (const s of staff) {
    if (!s.mgmtCode) {
      // Find next unused 3-5 digit code
      while (true) {
        const exists = await prisma.staff.findFirst({ where: { mgmtCode: String(code) } });
        if (!exists) break;
        code++;
      }
      await prisma.staff.update({ where: { id: s.id }, data: { mgmtCode: String(code) } });
      console.log(`Assigned mgmtCode ${code} to staff id=${s.id} name=${s.name}`);
      code++;
    }
  }
  console.log('Assignment complete');
}

run().catch(e => { console.error(e); process.exit(1); }).finally(()=> prisma.$disconnect());
