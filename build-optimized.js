#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始优化构建...');

// 清理输出目录
if (fs.existsSync('dist')) {
  console.log('🧹 清理旧的构建文件...');
  try {
    fs.rmSync('dist', { recursive: true, force: true });
  } catch (error) {
    console.log('⚠️ 清理失败，继续构建...');
  }
}

// 创建输出目录
fs.mkdirSync('dist', { recursive: true });

// 构建配置
const builds = [
  {
    name: 'Windows (GZip)',
    command: 'pkg . --targets node18-win-x64 --compress GZip --output dist/pup-sniffer-win.exe'
  },
  {
    name: 'Windows (Brotli - 最小体积)',
    command: 'pkg . --targets node18-win-x64 --compress Brotli --no-bytecode --public-packages=* --output dist/pup-sniffer-win-mini.exe'
  },
  {
    name: 'Linux (GZip)',
    command: 'pkg . --targets node18-linux-x64 --compress GZip --output dist/pup-sniffer-linux'
  },
  {
    name: 'Linux (Brotli - 最小体积)',
    command: 'pkg . --targets node18-linux-x64 --compress Brotli --no-bytecode --public-packages=* --output dist/pup-sniffer-linux-mini'
  },
  {
    name: 'macOS Intel (GZip)',
    command: 'pkg . --targets node18-macos-x64 --compress GZip --output dist/pup-sniffer-macos'
  },
  {
    name: 'macOS Intel (Brotli - 最小体积)',
    command: 'pkg . --targets node18-macos-x64 --compress Brotli --no-bytecode --public-packages=* --output dist/pup-sniffer-macos-mini'
  },
  {
    name: 'macOS ARM (GZip)',
    command: 'pkg . --targets node18-macos-arm64 --compress GZip --output dist/pup-sniffer-macos-arm64'
  },
  {
    name: 'macOS ARM (Brotli - 最小体积)',
    command: 'pkg . --targets node18-macos-arm64 --compress Brotli --no-bytecode --public-packages=* --output dist/pup-sniffer-macos-arm64-mini'
  }
];

// 执行构建
for (const build of builds) {
  console.log(`\n📦 构建: ${build.name}`);
  try {
    const startTime = Date.now();
    execSync(build.command, { stdio: 'inherit' });
    const endTime = Date.now();
    console.log(`✅ ${build.name} 构建完成 (${((endTime - startTime) / 1000).toFixed(1)}s)`);
  } catch (error) {
    console.error(`❌ ${build.name} 构建失败:`, error.message);
  }
}

// 显示文件大小统计
console.log('\n📊 构建结果统计:');
console.log('=' .repeat(60));

const distFiles = fs.readdirSync('dist').filter(file => 
  !file.includes('.') || file.endsWith('.exe')
);

distFiles.forEach(file => {
  const filePath = path.join('dist', file);
  const stats = fs.statSync(filePath);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`${file.padEnd(35)} ${sizeInMB.padStart(8)} MB`);
});

console.log('=' .repeat(60));
console.log('🎉 所有构建完成！');
console.log('\n💡 提示:');
console.log('- 使用 GZip 版本获得更好的兼容性');
console.log('- 使用 Brotli mini 版本获得最小体积');
console.log('- mini 版本可能需要更多运行时依赖');