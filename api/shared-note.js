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
      let stoveDate = null;
      let stoveNumber = null;
      if (latest && typeof latest.message === 'string') {
        const prefix = 'メモ更新\n';
        let body = latest.message.startsWith(prefix) ? latest.message.slice(prefix.length) : latest.message;
        // オプション拡張: 先頭に JSON メタデータ行 {"stoveDate":"...","stoveNumber":"..."}\n を許容
        if (body.startsWith('{')) {
          const firstNl = body.indexOf('\n');
          if (firstNl !== -1) {
            const metaRaw = body.slice(0, firstNl);
            try {
              const meta = JSON.parse(metaRaw);
              if (meta && typeof meta === 'object') {
                if (meta.stoveDate) stoveDate = meta.stoveDate;
                if (meta.stoveNumber) stoveNumber = meta.stoveNumber;
                body = body.slice(firstNl + 1); // メタデータ行除去
              }
            } catch(_) { /* not json meta */ }
          }
        }
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
      res.status(200).json({ ops, comm, stoveDate, stoveNumber, updatedAt: latest?.createdAt });
    } else if (req.method === 'POST') {
      const { content, ops, comm, stoveDate, stoveNumber } = req.body || {};
      // 後方互換: content があればそれを ops として扱う
      const rawOps = (ops !== undefined ? ops : content) || '';
      const rawComm = comm || '';
      const clip = (s)=> s.length > 15000 ? s.slice(0,15000) + '\n...[省略]' : s;
      const sanitizedOps = sanitizeContent(clip(rawOps.toString()));
      const sanitizedComm = sanitizeContent(clip(rawComm.toString()));
      // 先頭にJSONメタデータ行（空の場合は付与しない）
      let metaLine = '';
      if (stoveDate || stoveNumber) {
        const metaObj = { };
        if (stoveDate) metaObj.stoveDate = stoveDate;
        if (stoveNumber) metaObj.stoveNumber = stoveNumber;
        metaLine = JSON.stringify(metaObj) + '\n';
      }
      // ログ出力フォーマット
      const logBody = `${metaLine}[業務]\n${sanitizedOps}\n---\n[連絡]\n${sanitizedComm}`;
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
