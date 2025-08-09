// Vercel Serverless Function: GET/POST /api/logs
const prisma = require('./_prisma');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
      const result = await prisma.log.findMany({
        orderBy: { id: 'desc' },
        take: limit,
      });
      return res.status(200).json(result);
    }
    if (req.method === 'POST') {
      const { event, message } = req.body || {};
      if (!event || !message) return res.status(400).json({ error: 'event and message are required' });
      const created = await prisma.log.create({ data: { event, message }, select: { id: true } });
      return res.status(200).json({ id: created.id });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('Logs API error:', e);
    return res.status(500).json({ error: 'Logs API failed', detail: e.message });
  }
}
