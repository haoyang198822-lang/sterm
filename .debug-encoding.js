/**
 * 逐步骤追踪中文在 sterm 管线中的流转
 * 模拟: pty.write("好的") → PTY 回显 → 终端渲染
 */
const { spawn } = require('node-pty');
const pty = spawn(process.env.SHELL || '/bin/zsh', [], {
  name: 'xterm-256color', cols: 80, rows: 24,
  cwd: process.env.HOME,
  env: Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith('CONDA_'))
  ),
});

let output = '';

pty.onData((data) => {
  output += data;
  // 每个 PTY 回显块都记录
  const buf = Buffer.from(data, 'utf8');
  console.log('=== PTY onData chunk ===');
  console.log('  raw JSON:', JSON.stringify(data));
  console.log('  hex:', buf.toString('hex'));
  console.log('  char codes:', Array.from(data).map(c => c.charCodeAt(0).toString(16)).join(' '));
  // 检查是否有无效字符
  for (let i = 0; i < data.length; i++) {
    const cp = data.charCodeAt(i);
    if (cp >= 0xD800 && cp <= 0xDFFF) {
      console.log('  WARN: surrogate at pos', i, 'code:', cp.toString(16));
    }
    if (cp === 0xFFFD) {
      console.log('  ERROR: replacement char (U+FFFD) at pos', i);
    }
  }
});

// Step 1: 等 shell 就绪
setTimeout(() => {
  console.log('\n[TEST] Step 1: typing "好的"');
  console.log('  input chars:', '好的'.split('').map(c => c.charCodeAt(0).toString(16)).join(' '));
  
  pty.write('好的');
  
  // Step 2: 等 300ms 看回显
  setTimeout(() => {
    console.log('\n[TEST] Step 2: total output so far:');
    console.log('  hex:', Buffer.from(output, 'utf8').toString('hex'));
    
    // Step 3: 发送换行
    console.log('\n[TEST] Step 3: sending newline');
    pty.write('\n');
    
    setTimeout(() => {
      console.log('\n[TEST] Step 4: full output:');
      console.log('  hex:', Buffer.from(output, 'utf8').toString('hex'));
      console.log('  text:', JSON.stringify(output));
      process.exit(0);
    }, 300);
  }, 300);
}, 1500);
