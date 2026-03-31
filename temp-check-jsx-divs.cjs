const fs = require('fs');
const s = fs.readFileSync('app/categories/page.tsx', 'utf8');
const lines = s.split(/\r?\n/);
const stack = [];
const tagRegex = /<\/?([A-Za-z][A-Za-z0-9]*)[^>]*>/g;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let match;
  while ((match = tagRegex.exec(line)) !== null) {
    const raw = match[0];
    const tag = match[1];
    const isClosing = raw.startsWith('</');
    const selfClosing = raw.endsWith('/>');
    if (selfClosing) continue;
    if (!isClosing) {
      stack.push({ tag, line: i + 1, raw });
    } else {
      let idx = stack.length - 1;
      while (idx >= 0 && stack[idx].tag !== tag) {
        idx--;
      }
      if (idx < 0) {
        console.log('Unmatched closing', tag, 'at line', i + 1, raw);
      } else {
        stack.splice(idx, 1);
      }
    }
  }
}
console.log('Unmatched openings:', stack.length);
stack.slice(-10).forEach((item) => console.log(item));
