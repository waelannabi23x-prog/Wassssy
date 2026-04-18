'use strict';
function escMd(t) {
  if (!t) return '';
  return t.replace(/[*_`\[\]()~>#+=|{}.!\-]/g, '\\$&');
}
function starsDisplay(avg, cnt) {
  var full = Math.round(avg);
  var s = '';
  for (var i = 0; i < full; i++) s += '⭐';
  for (var i = 0; i < 5 - full; i++) s += '☆';
  if (cnt) s += ' ' + avg + '/5 (' + cnt + ' تقييم)';
  else s += ' لا يوجد تقييم';
  return s;
}
function buildPath(parts) {
  return parts.filter(Boolean).map(function(p) { return '*' + escMd(p) + '*'; }).join(' › ');
}
function formatDate(dateStr) {
  if (!dateStr) return 'غير معروف';
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'غير معروف';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) { return 'غير معروف'; }
}
module.exports = { escMd: escMd, starsDisplay: starsDisplay, buildPath: buildPath, formatDate: formatDate };
