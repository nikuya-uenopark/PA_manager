// Vercel Serverless Function: エクスポート API (Prisma 版)
const prisma = require('./_prisma');

module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    const [staff, criteria, evaluations] = await Promise.all([
      prisma.staff.findMany({ orderBy: { id: 'asc' } }),
      prisma.criteria.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
      prisma.evaluation.findMany({ orderBy: { id: 'asc' } }),
    ]);
    const exportData = {
      staff,
      criteria,
      evaluations,
      exportDate: new Date().toISOString(),
      version: '2.1'
    };
    res.status(200).json(exportData);
  } catch (error) {
    console.error('Export API error:', error);
    res.status(500).json({ 
      error: 'エクスポートAPI エラー', 
      detail: error.message 
    });
  }
}
