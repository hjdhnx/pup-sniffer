#!/usr/bin/env node

/**
 * Pup Sniffer 启动脚本
 * 提供简单的命令行参数支持
 */

const { spawn } = require('child_process');
const { dirname, join } = require('path');

// __filename 和 __dirname 在 CommonJS 中是内置的全局变量

// 解析命令行参数
const args = process.argv.slice(2);
const port = process.env.PORT || 57573;
const host = process.env.HOST || '0.0.0.0';

console.log('🚀 启动 Pup Sniffer 服务...');
console.log(`📍 监听地址: http://${host}:${port}`);
console.log('⏹️  按 Ctrl+C 停止服务\n');

// 设置环境变量
process.env.PORT = port;
process.env.HOST = host;

// 启动服务器
const serverPath = join(__dirname, 'server.cjs');
const child = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: process.env
});

// 处理子进程退出
child.on('exit', (code) => {
    if (code !== 0) {
        console.error(`❌ 服务器异常退出，退出码: ${code}`);
        process.exit(code);
    }
});

// 处理进程信号
process.on('SIGINT', () => {
    console.log('\n🛑 收到停止信号，正在关闭服务器...');
    child.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\n🛑 收到终止信号，正在关闭服务器...');
    child.kill('SIGTERM');
});