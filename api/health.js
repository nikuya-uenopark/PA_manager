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
    await prisma.$queryRaw`SELECT 1`;
    info.db = 'ok';
  } catch (e) {
    info.db = 'error';
    info.error = e.message;
  }
  res.status(200).json(info);
}
