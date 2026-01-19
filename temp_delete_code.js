const fs = require('fs');
const content = fs.readFileSync('src/components/ReplayModePlayer.vue', 'utf8');
const lines = content.split('\n');

// 找到开始行
let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// ==================== Setcode')) {
    startIndex = i;
    console.log('Found start at line:', i + 1);
  }
  if (startIndex >= 0 && lines[i].includes('function enterComboPreviewMode')) {
    endIndex = i;
    console.log('Found end at line:', i + 1);
    break;
  }
}

if (startIndex >= 0 && endIndex >= 0) {
  // 删除从 startIndex 到 endIndex-1 的所有行 (保留 endIndex 行)
  // 注意：startIndex 之前应该有 } 结束前一个函数
  const newLines = [
    ...lines.slice(0, startIndex),
    '',  // 空行
    ...lines.slice(endIndex)
  ];
  
  fs.writeFileSync('src/components/ReplayModePlayer.vue', newLines.join('\n'));
  console.log('Deleted lines from', startIndex + 1, 'to', endIndex);
  console.log('Total lines removed:', endIndex - startIndex);
} else {
  console.log('Could not find the code block to delete');
  console.log('startIndex:', startIndex, 'endIndex:', endIndex);
}

