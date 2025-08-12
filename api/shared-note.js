// /api/shared-note 共有メモ簡易API (Logsテーブルを使い最新1件を内容とみなす)
const prisma = require('./_prisma');
const { addLog } = require('./_log');
const { sanitizeContent } = require('./_sanitize');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  try {
    if (req.method === 'GET') {
      const latest = await prisma.log.findFirst({
        where: { event: 'shared-note' },
        orderBy: { createdAt: 'desc' }
      });
      // ログには "メモ更新" を含めて保存しているが、表示用には取り除く
      let content = '';
      if (latest && typeof latest.message === 'string') {
        const prefix = 'メモ更新\n';
        content = latest.message.startsWith(prefix) ? latest.message.slice(prefix.length) : latest.message;
      }
      res.status(200).json({ content });
    } else if (req.method === 'POST') {
      const { content } = req.body || {};
      const text = (content || '').toString();
      const clipped = text.length > 15000 ? text.slice(0,15000) + '\n...[省略]' : text;
  // 共有メモは改行のみ利用想定のため allowBr=false (デフォルト)
  const sanitized = sanitizeContent(clipped);
      await addLog('shared-note', `メモ更新\n${sanitized}`).catch(()=>{});
      res.status(200).json({ message: 'saved' });
    } else {
      res.status(405).json({ error: 'Method Not Allowed'});
    }
  } catch (e) {
    console.error('shared-note api error', e);
    res.status(500).json({ error: 'shared-note failed', detail: e.message });
  }
};
