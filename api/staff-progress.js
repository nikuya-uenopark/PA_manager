// Vercel Serverless Function: GET /api/staff-progress
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.position,
        COUNT(e.id) as total_criteria,
        SUM(CASE WHEN e.status = 'can-do' THEN 1 ELSE 0 END) as completed_criteria,
        ROUND((SUM(CASE WHEN e.status = 'can-do' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(e.id),0)) * 100) as progress_percentage
      FROM staff s
      LEFT JOIN evaluations e ON s.id = e.staff_id
      GROUP BY s.id, s.name, s.position
      ORDER BY s.created_at DESC
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'スタッフ進捗情報の取得に失敗しました', detail: error.message });
  }
}
