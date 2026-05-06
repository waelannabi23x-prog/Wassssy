const fs = require('fs');
const html = fs.readFileSync('public/app/index.html', 'utf8');
const match = html.match(/<script>([\s\S]*)<\/script>/);
const js = match[1];
const lines = js.split('\n');
let inTemplate = false;
lines.forEach((l,i) => {
  const ticks = (l.match(/`/g)||[]).length;
  if(ticks % 2 !== 0) inTemplate = !inTemplate;
  if(!inTemplate && /[=(,+]\s*<[a-zA-Z]/.test(l)) {
    console.log('L'+(i+1)+':', l.trim().substring(0,90));
  }
});
