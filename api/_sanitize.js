// 共通サニタイズユーティリティ
// - 危険タグ(script/iframe/object/embed/svg/link/meta)除去
// - javascript: スキーム除去
// - onXXX= イベント属性除去
// - <br> を許可するオプション（他はエスケープ）
// - & < > をエスケープ

const DANGEROUS_TAG_RE = /<\s*(script|iframe|object|embed|svg|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1>/gi;
const SINGLE_DANGEROUS_OPEN_RE = /<\s*script[^>]*>/gi;
const EVENT_ATTR_RE_DQ = /on[a-z]+\s*=\s*"[^"]*"/gi;
const EVENT_ATTR_RE_SQ = /on[a-z]+\s*=\s*'[^']*'/gi;
const EVENT_ATTR_RE_BARE = /on[a-z]+\s*=\s*[^\s>]+/gi;
const JS_SCHEME_RE = /javascript:/gi;

function sanitizeContent(raw, opts = {}) {
  if (raw == null) return '';
  let s = String(raw);
  const allowBr = !!opts.allowBr;
  // 一旦 <br> をプレースホルダに
  let placeholders = [];
  if (allowBr) {
    s = s.replace(/<br\s*\/? >|<br\s*\/>|<br>/gi, m => {
      placeholders.push('@@BR@@');
      return '@@BR@@';
    });
  }
  // 危険タグ除去
  s = s.replace(DANGEROUS_TAG_RE, '[removed]');
  s = s.replace(SINGLE_DANGEROUS_OPEN_RE, '[removed]');
  // スキーム除去
  s = s.replace(JS_SCHEME_RE, '');
  // イベント属性除去
  s = s.replace(EVENT_ATTR_RE_DQ, '')
       .replace(EVENT_ATTR_RE_SQ, '')
       .replace(EVENT_ATTR_RE_BARE, '');
  // エスケープ
  s = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // <br> 復元
  if (allowBr) {
    s = s.replace(/@@BR@@/g,'<br>');
  }
  return s;
}

module.exports = { sanitizeContent };
