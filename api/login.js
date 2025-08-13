// /api/login 管理番号による簡易ログインAPI
const prisma = require('./_prisma');
const { sanitizeContent } = require('./_sanitize');

module.exports = async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error:'Method Not Allowed' }); return; }
  try {
    const { code } = req.body || {};
    const raw = (code||'').toString();
    const sanitized = sanitizeContent(raw).replace(/[^0-9]/g,'');
    if (!/^\d{3,5}$/.test(sanitized)) {
      return res.status(400).json({ error: 'code must be 3-5 digits' });
    }
    const staff = await prisma.staff.findFirst({ where:{ mgmtCode: sanitized }, select:{ id:true, name:true } });
    if (!staff) return res.status(401).json({ error:'invalid code' });
    // 簡易トークン(署名なし) ※必要なら将来JWTに置換
    const token = Buffer.from(JSON.stringify({ sid:staff.id, t:Date.now() })).toString('base64');
    res.status(200).json({ token, staff });
  } catch(e) {
    console.error('login error', e);
    res.status(500).json({ error:'login failed', detail:e.message });
  }
};
