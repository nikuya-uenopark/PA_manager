// Vercel Serverless Function: GET /api/stats
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
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
    res.status(500).json({ error: '統計情報の取得に失敗しました', detail: error.message });
  }
}
