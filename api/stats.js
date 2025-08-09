// Vercel Serverless Function: 統計・分析 API
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
    const [staffCount, criteriaCount, progress] = await Promise.all([
      prisma.staff.count(),
      prisma.criteria.count(),
      prisma.evaluation.aggregate({ _avg: { score: true } })
    ]);
    // 旧ロジックのダミー（statusで進捗算出していた箇所は要件次第で置換）
    const overallProgress = Number.isFinite(progress._avg.score) ? Math.round(progress._avg.score || 0) : 0;
    res.status(200).json({
      staffCount,
      criteriaCount,
      overallProgress
    });
  } catch (error) {
    console.error('Stats API error:', error);
    res.status(500).json({ 
      error: '統計API エラー', 
      detail: error.message 
    });
  }
}
