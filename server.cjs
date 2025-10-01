const Fastify = require('fastify');
const cors = require('@fastify/cors');
const { readFileSync } = require('fs');
const { join, dirname } = require('path');
const { createServer } = require('net');
const { Sniffer } = require('./sniffer.cjs');

// __filename 和 __dirname 在 CommonJS 中是内置的全局变量

// 解析命令行参数
function parseCommandLineArgs() {
    const args = process.argv.slice(2);
    const options = {
        port: null,
        help: false
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '-port' || arg === '--port') {
            if (i + 1 < args.length) {
                const portValue = parseInt(args[i + 1]);
                if (!isNaN(portValue) && portValue > 0 && portValue <= 65535) {
                    options.port = portValue;
                    i++; // 跳过端口值参数
                } else {
                    console.error('错误：端口号必须是1-65535之间的数字');
                    process.exit(1);
                }
            } else {
                console.error('错误：-port 参数需要指定端口号');
                process.exit(1);
            }
        } else if (arg === '-h' || arg === '--help') {
            options.help = true;
        } else if (arg.startsWith('-')) {
            console.error(`错误：未知参数 ${arg}`);
            console.log('使用 -h 或 --help 查看帮助信息');
            process.exit(1);
        }
    }
    
    return options;
}

// 显示帮助信息
function showHelp() {
    console.log(`
Pup Sniffer - 视频资源嗅探器

使用方法:
  node server.cjs [选项]
  pup-sniffer-win.exe [选项]

选项:
  -port <端口号>    指定服务器端口号 (1-65535)
  -h, --help       显示此帮助信息

示例:
  node server.cjs -port 8080
  pup-sniffer-win.exe -port 3000

如果不指定端口号，服务器将从57573开始自动查找可用端口。
`);
}

// 检查端口是否可用
function checkPortAvailable(port) {
    return new Promise((resolve) => {
        const server = createServer();
        
        server.listen(port, '0.0.0.0', () => {
            server.once('close', () => {
                resolve(true);
            });
            server.close();
        });
        
        server.on('error', (err) => {
            resolve(false);
        });
    });
}

// 查找可用端口
async function findAvailablePort(startPort = 57573) {
    let port = startPort;
    const maxAttempts = 100; // 最多尝试100个端口
    
    for (let i = 0; i < maxAttempts; i++) {
        const isAvailable = await checkPortAvailable(port);
        if (isAvailable) {
            return port;
        }
        port++;
    }
    
    throw new Error(`无法找到可用端口，已尝试从 ${startPort} 到 ${startPort + maxAttempts - 1}`);
}

// 获取资源文件路径（兼容打包后的环境）
function getResourcePath(filename) {
    // 在打包环境中，资源文件被打包到可执行文件内部
    if (process.pkg) {
        // pkg 会将 assets 中的文件打包到虚拟文件系统中
        // 使用 __dirname 可以访问打包后的虚拟路径
        return join(__dirname, filename);
    }
    // 开发环境中使用相对路径
    return join(__dirname, filename);
}

// 创建 Fastify 实例
const fastify = Fastify({
    logger: {
        level: 'info',
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true
            }
        }
    }
});

// 全局 Sniffer 实例
let globalSniffer = null;

/**
 * 初始化 Sniffer 实例
 */
async function initSniffer() {
    if (!globalSniffer) {
        globalSniffer = new Sniffer({
            debug: true,
            headless: true,
            useChrome: true
        });
        await globalSniffer.initBrowser();
    }
    return globalSniffer;
}

/**
 * 解码 Base64 字符串
 */
function decodeBase64(str) {
    if (!str) return '';
    try {
        return Buffer.from(str, 'base64').toString('utf-8');
    } catch (e) {
        return str;
    }
}

/**
 * 验证 URL 格式
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * 解析请求头字符串
 */
function parseHeaders(headerStr) {
    if (!headerStr) return {};
    
    const headers = {};
    try {
        const lines = headerStr.split('\n');
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim().toLowerCase();
                const value = line.substring(colonIndex + 1).trim();
                if (key && value) {
                    headers[key] = value;
                }
            }
        }
    } catch (e) {
        console.error('解析请求头失败:', e.message);
    }
    
    return headers;
}

/**
 * 创建统一的响应格式
 */
function createResponse(data = null, code = 200, msg = 'success') {
    return {
        code,
        msg,
        data,
        timestamp: Date.now()
    };
}

/**
 * 创建错误响应
 */
function createErrorResponse(msg, code = 400) {
    return createResponse(null, code, msg);
}

// 首页路由 - 提供演示页面
fastify.get('/', async (request, reply) => {
    try {
        const htmlPath = getResourcePath('demo.html');
        const htmlContent = readFileSync(htmlPath, 'utf-8');
        reply.type('text/html').send(htmlContent);
    } catch (error) {
        fastify.log.error('无法加载演示页面:', error);
        reply.code(500).send(createErrorResponse('无法加载演示页面'));
    }
});

// 健康检查接口
fastify.get('/health', async (request, reply) => {
    return createResponse({ status: 'ok', service: 'pup-sniffer' });
});

// 活跃状态检口
fastify.get('/active', async (request, reply) => {
    return createResponse({ 
        active: true, 
        browser: globalSniffer ? 'initialized' : 'not_initialized',
        timestamp: new Date().toISOString()
    });
});

// 主要的嗅探接口
fastify.get('/sniffer', async (request, reply) => {
    const startTime = Date.now();
    
    try {
        // 获取请求参数
        const {
            url,
            is_pc = '0',
            css = '',
            script = '',
            init_script = '',
            headers = '',
            timeout = '10000',
            custom_regex = '',
            sniffer_exclude = '',
            mode = '0'
        } = request.query;

        // 验证必需参数
        if (!url) {
            return createErrorResponse('缺少必需参数: url');
        }

        if (!isValidUrl(url)) {
            return createErrorResponse('无效的 URL 格式');
        }

        // 解析参数
        let parsedScript = '';
        let parsedInitScript = '';
        let parsedHeaders = {};
        let parsedTimeout = 10000;
        let parsedMode = 0;
        let parsedIsPc = false;

        // 解码 Base64 脚本
        try {
            parsedScript = script ? decodeBase64(script) : '';
        } catch (e) {
            console.warn('解码 script 失败:', e.message);
            parsedScript = script;
        }

        try {
            parsedInitScript = init_script ? decodeBase64(init_script) : '';
        } catch (e) {
            console.warn('解码 init_script 失败:', e.message);
            parsedInitScript = init_script;
        }

        // 解析请求头
        try {
            parsedHeaders = parseHeaders(headers);
        } catch (e) {
            console.warn('解析 headers 失败:', e.message);
        }

        // 解析超时时间
        try {
            parsedTimeout = parseInt(timeout) || 10000;
            parsedTimeout = Math.min(parsedTimeout, 60000); // 最大 60 秒
        } catch (e) {
            parsedTimeout = 10000;
        }

        // 解析模式
        try {
            parsedMode = parseInt(mode) || 0;
        } catch (e) {
            parsedMode = 0;
        }

        // 解析是否为 PC
        try {
            parsedIsPc = is_pc === '1' || is_pc === 'true';
        } catch (e) {
            parsedIsPc = false;
        }

        // 初始化 Sniffer
        const sniffer = await initSniffer();

        // 执行嗅探
        const result = await sniffer.snifferMediaUrl(url, {
            mode: parsedMode,
            customRegex: custom_regex || null,
            snifferExclude: sniffer_exclude || null,
            timeout: parsedTimeout,
            css: css || null,
            isPc: parsedIsPc,
            headers: Object.keys(parsedHeaders).length > 0 ? parsedHeaders : null,
            script: parsedScript || null,
            initScript: parsedInitScript || null
        });

        const totalCost = Date.now() - startTime;
        
        // 添加总耗时信息
        if (result && typeof result === 'object') {
            result.total_cost = `${totalCost} ms`;
        }

        return createResponse(result);

    } catch (error) {
        console.error('嗅探过程中发生错误:', error);
        
        const totalCost = Date.now() - startTime;
        
        return createErrorResponse(
            `嗅探失败: ${error.message}`,
            500
        );
    }
});

// 获取页面源码接口
fastify.get('/fetCodeByWebView', async (request, reply) => {
    const startTime = Date.now();
    
    try {
        // 获取请求参数
        const {
            url,
            is_pc = '0',
            css = '',
            script = '',
            init_script = '',
            headers = '',
            timeout = '10000'
        } = request.query;

        // 验证必需参数
        if (!url) {
            return createErrorResponse('缺少必需参数: url');
        }

        if (!isValidUrl(url)) {
            return createErrorResponse('无效的 URL 格式');
        }

        // 解析参数
        let parsedScript = '';
        let parsedInitScript = '';
        let parsedHeaders = {};
        let parsedTimeout = 10000;
        let parsedIsPc = false;

        // 解码 Base64 脚本
        try {
            parsedScript = script ? decodeBase64(script) : '';
        } catch (e) {
            console.warn('解码 script 失败:', e.message);
            parsedScript = script;
        }

        try {
            parsedInitScript = init_script ? decodeBase64(init_script) : '';
        } catch (e) {
            console.warn('解码 init_script 失败:', e.message);
            parsedInitScript = init_script;
        }

        // 解析请求头
        try {
            parsedHeaders = parseHeaders(headers);
        } catch (e) {
            console.warn('解析 headers 失败:', e.message);
        }

        // 解析超时时间
        try {
            parsedTimeout = parseInt(timeout) || 10000;
            parsedTimeout = Math.min(parsedTimeout, 60000); // 最大 60 秒
        } catch (e) {
            parsedTimeout = 10000;
        }

        // 解析是否为 PC
        try {
            parsedIsPc = is_pc === '1' || is_pc === 'true';
        } catch (e) {
            parsedIsPc = false;
        }

        // 初始化 Sniffer
        const sniffer = await initSniffer();

        // 获取页面源码
        const result = await sniffer.fetCodeByWebView(url, {
            headers: Object.keys(parsedHeaders).length > 0 ? parsedHeaders : null,
            timeout: parsedTimeout,
            isPc: parsedIsPc,
            css: css || null,
            script: parsedScript || null,
            initScript: parsedInitScript || null
        });

        const totalCost = Date.now() - startTime;
        
        // 添加总耗时信息
        if (result && typeof result === 'object') {
            result.total_cost = `${totalCost} ms`;
        }

        return createResponse(result);

    } catch (error) {
        console.error('获取页面源码过程中发生错误:', error);
        
        const totalCost = Date.now() - startTime;
        
        return createErrorResponse(
            `获取页面源码失败: ${error.message}`,
            500
        );
    }
});

// 错误处理
fastify.setErrorHandler((error, request, reply) => {
    console.error('服务器错误:', error);
    
    reply.status(500).send(createErrorResponse(
        `服务器内部错误: ${error.message}`,
        500
    ));
});

// 404 处理
fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send(createErrorResponse(
        `路径 ${request.url} 不存在`,
        404
    ));
});

// 优雅关闭处理
process.on('SIGINT', async () => {
    console.log('收到 SIGINT 信号，正在关闭服务器...');
    
    if (globalSniffer) {
        try {
            await globalSniffer.close();
            console.log('Sniffer 实例已关闭');
        } catch (e) {
            console.error('关闭 Sniffer 实例时发生错误:', e.message);
        }
    }
    
    try {
        await fastify.close();
        console.log('服务器已关闭');
        process.exit(0);
    } catch (e) {
        console.error('关闭服务器时发生错误:', e.message);
        process.exit(1);
    }
});

// 启动服务器
const start = async () => {
    try {
        // 解析命令行参数
        const options = parseCommandLineArgs();
        
        // 如果请求帮助，显示帮助信息并退出
        if (options.help) {
            showHelp();
            process.exit(0);
        }
        
        // 注册 CORS 插件
        await fastify.register(cors, {
            origin: true,
            credentials: true
        });
        
        const host = process.env.HOST || '0.0.0.0';
        let port;
        
        // 确定使用的端口
        if (options.port) {
            // 使用指定的端口
            const isAvailable = await checkPortAvailable(options.port);
            if (!isAvailable) {
                console.error(`错误：指定的端口 ${options.port} 已被占用`);
                process.exit(1);
            }
            port = options.port;
            console.log(`使用指定端口: ${port}`);
        } else {
            // 自动查找可用端口
            console.log('正在查找可用端口...');
            port = await findAvailablePort();
            console.log(`找到可用端口: ${port}`);
        }
        
        await fastify.listen({ port, host });
        console.log(`🚀 服务器已启动，监听地址: http://${host}:${port}`);
        console.log(`📡 嗅探接口: http://${host}:${port}/sniffer`);
        console.log(`📄 页面源码接口: http://${host}:${port}/fetCodeByWebView`);
        console.log(`💚 健康检查: http://${host}:${port}/health`);
        console.log(`🔄 活跃状态: http://${host}:${port}/active`);
        
    } catch (err) {
        console.error('启动服务器失败:', err);
        process.exit(1);
    }
};

start();