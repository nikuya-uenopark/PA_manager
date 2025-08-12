// /api/shared-note 共有メモ簡易API (Logsテーブルを使い最新1件を内容とみなす)
const prisma = require('./_prisma');
const { addLog } = require('./_log');

// 簡易サニタイズ関数
function sanitizeContent(raw) {
  if (raw == null) return '';
  let s = String(raw);
  s = s.replace(/<\s*(script|iframe|object|embed|svg|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1>/gi, '[removed]');
  s = s.replace(/<\s*script[^>]*>/gi, '[removed]');
  s = s.replace(/javascript:/gi, '');
  s = s.replace(/on[a-z]+\s*=\s*"[^"]*"/gi,'')
       .replace(/on[a-z]+\s*=\s*'[^']*'/gi,'')
       .replace(/on[a-z]+\s*=\s*[^\s>]+/gi,'');
  s = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return s;
}

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
      res.status(200).json({ content: latest ? latest.message : '' });
    } else if (req.method === 'POST') {
      const { content } = req.body || {};
      const text = (content || '').toString();
      const clipped = text.length > 15000 ? text.slice(0,15000) + '\n...[省略]' : text;
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
