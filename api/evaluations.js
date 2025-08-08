// Vercel Serverless Function: GET/POST /api/evaluations
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    if (req.method === 'GET') {
      const { staffId } = req.query;
      if (staffId) {
        const [rows] = await connection.execute(
          `SELECT e.*, c.name, c.category, c.description 
           FROM evaluations e 
           JOIN criteria c ON e.criteria_id = c.id 
           WHERE e.staff_id = ? 
           ORDER BY c.category, c.name`,
          [staffId]
        );
        res.status(200).json(rows);
      } else {
        const [rows] = await connection.execute('SELECT * FROM evaluations ORDER BY created_at DESC');
        res.status(200).json(rows);
      }
    } else if (req.method === 'POST') {
      const { staff_id, criteria_id, status } = req.body;
      const [result] = await connection.execute(
        'INSERT INTO evaluations (staff_id, criteria_id, status) VALUES (?, ?, ?)',
        [staff_id, criteria_id, status || 'learning']
      );
      res.status(200).json({ id: result.insertId, message: '評価データが追加されました' });
    } else if (req.method === 'PUT') {
      const { staffId, criteriaId, status } = req.body;
      await connection.execute(
        'UPDATE evaluations SET status = ? WHERE staff_id = ? AND criteria_id = ?',
        [status, staffId, criteriaId]
      );
      res.status(200).json({ message: '評価が更新されました' });
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'evaluations API error', detail: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
