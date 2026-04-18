'use strict';
function safeInt(v) {
  if (v === null || v === undefined) return 0;
  var n = parseInt(v);
  return isNaN(n) ? 0 : n;
}
function safeStr(v, max) {
  if (v === null || v === undefined) return '';
  var s = String(v).trim();
  if (max && s.length > max) s = s.substring(0, max);
  return s;
}
function safeId(v) { return safeInt(v); }
module.exports = { safeInt: safeInt, safeStr: safeStr, safeId: safeId };
