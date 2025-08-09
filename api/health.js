// Health check for API/DB connectivity and deployment freshness
const prisma = require('./_prisma');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const info = {
    ok: true,
    time: new Date().toISOString(),
    node: process.version,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
  };
  try {
    // Lightweight probe
    const ping = await prisma.$queryRaw`SELECT current_database() AS db, current_schema() AS schema`;
    info.db = 'ok';
    info.database = ping?.[0]?.db;
    info.schema = ping?.[0]?.schema;
    // Counts for quick sanity check
    info.counts = {
      staff: await prisma.staff.count().catch(()=>null),
      criteria: await prisma.criteria.count().catch(()=>null),
    };
    // URL (sanitized)
    try {
      const u = new URL(process.env.DATABASE_URL || '');
      info.dbHost = u.hostname;
      info.dbPath = u.pathname;
      info.dbPooler = u.hostname.includes('pooler');
      info.dbSSL = (u.search || '').includes('sslmode=require');
    } catch {}
  } catch (e) {
    info.db = 'error';
    info.error = e.message;
  }
  res.status(200).json(info);
}
