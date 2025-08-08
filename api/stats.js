// Vercel Serverless Function: 統計・分析 API
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
    const staffCount = await pool.query('SELECT COUNT(*) as count FROM staff');
    const criteriaCount = await pool.query('SELECT COUNT(*) as count FROM criteria');
    const progressData = await pool.query("SELECT AVG(CASE WHEN status = 'can-do' THEN 100 ELSE 0 END) as overall_progress FROM evaluations");
    res.status(200).json({
      staffCount: staffCount.rows[0].count,
      criteriaCount: criteriaCount.rows[0].count,
      overallProgress: Math.round(progressData.rows[0].overall_progress || 0)
    });
  } catch (error) {
    console.error('Stats API error:', error);
    res.status(500).json({ 
      error: '統計API エラー', 
      detail: error.message 
    });
  }
}
