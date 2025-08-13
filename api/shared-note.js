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
      let ops = '';
      let comm = '';
      if (latest && typeof latest.message === 'string') {
        const prefix = 'メモ更新\n';
        let body = latest.message.startsWith(prefix) ? latest.message.slice(prefix.length) : latest.message;
        // 新フォーマット: [業務]\n...\n---\n[連絡]\n...
        if (body.startsWith('[業務]\n')) {
          const marker = '\n---\n[連絡]\n';
            const mid = body.indexOf(marker);
            if (mid !== -1) {
              ops = body.slice(4 + 1, mid); // after '[業務]\n'
              comm = body.slice(mid + marker.length);
            } else {
              // '[業務]' プレフィックスのみ（旧→業務扱い）
              ops = body.replace(/^\[業務\]\n/, '');
            }
        } else {
          // 旧単一メモ -> 業務扱い
          ops = body;
        }
      }
      res.status(200).json({ ops, comm, updatedAt: latest?.createdAt });
    } else if (req.method === 'POST') {
      const { content, ops, comm } = req.body || {};
      // 後方互換: content があればそれを ops として扱う
      const rawOps = (ops !== undefined ? ops : content) || '';
      const rawComm = comm || '';
      const clip = (s)=> s.length > 15000 ? s.slice(0,15000) + '\n...[省略]' : s;
      const sanitizedOps = sanitizeContent(clip(rawOps.toString()));
      const sanitizedComm = sanitizeContent(clip(rawComm.toString()));
      // ログ出力フォーマット（アクティビティログ閲覧性重視, 両方空は許容）
      const logBody = `[業務]\n${sanitizedOps}\n---\n[連絡]\n${sanitizedComm}`;
      await addLog('shared-note', `メモ更新\n${logBody}`).catch(()=>{});
      res.status(200).json({ message: 'saved' });
    } else {
      res.status(405).json({ error: 'Method Not Allowed'});
    }
  } catch (e) {
    console.error('shared-note api error', e);
    res.status(500).json({ error: 'shared-note failed', detail: e.message });
  }
};
