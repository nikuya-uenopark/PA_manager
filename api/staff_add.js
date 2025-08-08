// Vercel Serverless Function: POST /api/staff_add
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  let connection;
  try {
    const { name, position } = req.body;
    connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO staff (name, position) VALUES (?, ?)',
      [name, position || '未設定']
    );
    // 新しいスタッフに全評価項目を学習中で初期化
    const [criteria] = await connection.execute('SELECT id FROM criteria');
    for (const criterion of criteria) {
      await connection.execute(
        'INSERT INTO evaluations (staff_id, criteria_id, status) VALUES (?, ?, "learning")',
        [result.insertId, criterion.id]
      );
    }
    res.status(200).json({ id: result.insertId, message: 'スタッフが追加されました' });
  } catch (error) {
    res.status(500).json({ error: 'スタッフの追加に失敗しました', detail: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
