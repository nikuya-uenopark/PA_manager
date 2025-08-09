// Simple write test to verify Prisma inserts in current environment
const prisma = require('./_prisma');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const name = `debug-${Date.now()}`;
    const row = await prisma.staff.create({ data: { name } });
    res.status(200).json({ ok: true, id: row.id, name });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
