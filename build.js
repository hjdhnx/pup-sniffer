#!/usr/bin/env node

const { execSync } = require('child_process');
const { copyFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');

console.log('🚀 开始构建 Pup Sniffer...');

// 创建 dist 目录
if (!existsSync('dist')) {
    mkdirSync('dist', { recursive: true });
    console.log('📁 创建 dist 目录');
}

// 复制资源文件到 dist 目录
const resourceFiles = ['demo.html'];
resourceFiles.forEach(file => {
    try {
        copyFileSync(file, join('dist', file));
        console.log(`📄 复制资源文件: ${file}`);
    } catch (error) {
        console.error(`❌ 复制文件失败 ${file}:`, error.message);
    }
});

// 构建所有平台
const platforms = [
    { name: 'Windows x64', script: 'build:win' },
    { name: 'Linux x64', script: 'build:linux' },
    { name: 'macOS x64', script: 'build:macos' },
    { name: 'macOS ARM64', script: 'build:macos-arm' }
];

console.log('\n🔨 开始打包二进制文件...');

for (const platform of platforms) {
    try {
        console.log(`\n📦 正在构建 ${platform.name}...`);
        execSync(`npm run ${platform.script}`, { stdio: 'inherit' });
        console.log(`✅ ${platform.name} 构建完成`);
    } catch (error) {
        console.error(`❌ ${platform.name} 构建失败:`, error.message);
    }
}

console.log('\n🎉 构建完成！输出目录: ./dist/');
console.log('\n📋 可用的二进制文件:');
console.log('  - pup-sniffer-win.exe     (Windows x64)');
console.log('  - pup-sniffer-linux       (Linux x64)');
console.log('  - pup-sniffer-macos       (macOS x64)');
console.log('  - pup-sniffer-macos-arm64 (macOS ARM64)');
console.log('\n💡 使用方法: 将对应的二进制文件和 demo.html 放在同一目录下运行');