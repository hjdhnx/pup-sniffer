/**
 * 快速测试脚本 - 不依赖 Puppeteer 安装
 * 测试基本的服务器功能和接口
 */

const { createServer } = require('http');
const { URL } = require('url');

// 模拟 Sniffer 类（用于测试）
class MockSniffer {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.headless = options.headless !== false;
    }

    log(...args) {
        if (this.debug) {
            console.log('[MockSniffer]', ...args);
        }
    }

    async initBrowser() {
        this.log('模拟浏览器初始化');
        return Promise.resolve();
    }

    async close() {
        this.log('模拟浏览器关闭');
        return Promise.resolve();
    }

    async snifferMediaUrl(playUrl, options = {}) {
        this.log('模拟嗅探:', playUrl);
        
        // 模拟嗅探结果
        const mockResult = {
            url: 'https://mock-video.example.com/video.m3u8',
            headers: {
                'referer': playUrl,
                'user-agent': 'Mozilla/5.0 (Mock Browser)'
            },
            from: playUrl,
            cost: '1234 ms',
            code: 200,
            script: options.script || null,
            init_script: options.initScript || null,
            msg: '超级嗅探解析成功（模拟）'
        };

        return Promise.resolve(mockResult);
    }

    async fetCodeByWebView(url, options = {}) {
        this.log('模拟获取页面源码:', url);
        
        // 模拟页面源码
        const mockResult = {
            content: `<!DOCTYPE html><html><head><title>Mock Page</title></head><body><h1>Mock Content for ${url}</h1></body></html>`,
            headers: { location: url },
            cost: '567 ms'
        };

        return Promise.resolve(mockResult);
    }
}

// 简化的服务器实现
function createMockServer() {
    let mockSniffer = null;

    const server = createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;
        const searchParams = url.searchParams;

        // 设置 CORS 头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // 处理 OPTIONS 请求
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        try {
            // 初始化 MockSniffer
            if (!mockSniffer) {
                mockSniffer = new MockSniffer({ debug: true });
                await mockSniffer.initBrowser();
            }

            // 路由处理
            if (pathname === '/health') {
                const response = {
                    code: 200,
                    msg: 'success',
                    data: { status: 'ok', service: 'pup-sniffer-mock' },
                    timestamp: Date.now()
                };
                res.writeHead(200);
                res.end(JSON.stringify(response, null, 2));

            } else if (pathname === '/active') {
                const response = {
                    code: 200,
                    msg: 'success',
                    data: { 
                        active: true, 
                        browser: 'mock_initialized',
                        timestamp: new Date().toISOString()
                    },
                    timestamp: Date.now()
                };
                res.writeHead(200);
                res.end(JSON.stringify(response, null, 2));

            } else if (pathname === '/sniffer') {
                const targetUrl = searchParams.get('url');
                
                if (!targetUrl) {
                    const errorResponse = {
                        code: 400,
                        msg: '缺少必需参数: url',
                        data: null,
                        timestamp: Date.now()
                    };
                    res.writeHead(400);
                    res.end(JSON.stringify(errorResponse, null, 2));
                    return;
                }

                // 解析参数
                const mode = parseInt(searchParams.get('mode') || '0');
                const timeout = parseInt(searchParams.get('timeout') || '10000');
                const script = searchParams.get('script') || '';
                const initScript = searchParams.get('init_script') || '';

                // 执行模拟嗅探
                const result = await mockSniffer.snifferMediaUrl(targetUrl, {
                    mode,
                    timeout,
                    script,
                    initScript
                });

                const response = {
                    code: 200,
                    msg: 'success',
                    data: result,
                    timestamp: Date.now()
                };
                res.writeHead(200);
                res.end(JSON.stringify(response, null, 2));

            } else if (pathname === '/fetCodeByWebView') {
                const targetUrl = searchParams.get('url');
                
                if (!targetUrl) {
                    const errorResponse = {
                        code: 400,
                        msg: '缺少必需参数: url',
                        data: null,
                        timestamp: Date.now()
                    };
                    res.writeHead(400);
                    res.end(JSON.stringify(errorResponse, null, 2));
                    return;
                }

                // 执行模拟页面源码获取
                const result = await mockSniffer.fetCodeByWebView(targetUrl);

                const response = {
                    code: 200,
                    msg: 'success',
                    data: result,
                    timestamp: Date.now()
                };
                res.writeHead(200);
                res.end(JSON.stringify(response, null, 2));

            } else {
                // 404 处理
                const errorResponse = {
                    code: 404,
                    msg: `路径 ${pathname} 不存在`,
                    data: null,
                    timestamp: Date.now()
                };
                res.writeHead(404);
                res.end(JSON.stringify(errorResponse, null, 2));
            }

        } catch (error) {
            console.error('服务器错误:', error);
            const errorResponse = {
                code: 500,
                msg: `服务器内部错误: ${error.message}`,
                data: null,
                timestamp: Date.now()
            };
            res.writeHead(500);
            res.end(JSON.stringify(errorResponse, null, 2));
        }
    });

    return server;
}

// 启动测试服务器
async function startTestServer() {
    const port = process.env.PORT || 3001;
    const host = process.env.HOST || '0.0.0.0';
    
    const server = createMockServer();
    
    server.listen(port, host, () => {
        console.log('🧪 Mock Sniffer 测试服务器已启动');
        console.log(`📍 监听地址: http://${host}:${port}`);
        console.log('🔗 测试接口:');
        console.log(`   健康检查: http://${host}:${port}/health`);
        console.log(`   活跃状态: http://${host}:${port}/active`);
        console.log(`   嗅探接口: http://${host}:${port}/sniffer?url=https://example.com`);
        console.log(`   页面源码: http://${host}:${port}/fetCodeByWebView?url=https://example.com`);
        console.log('⏹️  按 Ctrl+C 停止服务');
    });

    // 优雅关闭
    process.on('SIGINT', () => {
        console.log('\n🛑 收到停止信号，正在关闭测试服务器...');
        server.close(() => {
            console.log('✅ 测试服务器已关闭');
            process.exit(0);
        });
    });
}

// 测试客户端
async function testClient() {
    const baseUrl = 'http://localhost:3001';
    
    console.log('🧪 开始测试客户端...\n');

    try {
        // 测试健康检查
        console.log('💚 测试健康检查...');
        const healthResponse = await fetch(`${baseUrl}/health`);
        const healthData = await healthResponse.json();
        console.log('✅ 健康检查响应:', healthData.data);

        // 测试活跃状态
        console.log('\n🔄 测试活跃状态...');
        const activeResponse = await fetch(`${baseUrl}/active`);
        const activeData = await activeResponse.json();
        console.log('✅ 活跃状态响应:', activeData.data);

        // 测试嗅探接口
        console.log('\n📡 测试嗅探接口...');
        const snifferUrl = `${baseUrl}/sniffer?url=https://example.com/video&mode=0&timeout=5000`;
        const snifferResponse = await fetch(snifferUrl);
        const snifferData = await snifferResponse.json();
        console.log('✅ 嗅探接口响应:', snifferData.data);

        // 测试页面源码接口
        console.log('\n📄 测试页面源码接口...');
        const codeUrl = `${baseUrl}/fetCodeByWebView?url=https://example.com`;
        const codeResponse = await fetch(codeUrl);
        const codeData = await codeResponse.json();
        console.log('✅ 页面源码接口响应长度:', codeData.data.content.length);

        console.log('\n🎉 所有测试通过！');

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.log('💡 请确保测试服务器已启动');
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--client')) {
        await testClient();
    } else {
        await startTestServer();
    }
}

main().catch(console.error);