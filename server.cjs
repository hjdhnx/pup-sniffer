const Fastify = require('fastify');
const cors = require('@fastify/cors');
const { readFileSync } = require('fs');
const { join, dirname } = require('path');
const { Sniffer } = require('./sniffer.cjs');

// __filename 和 __dirname 在 CommonJS 中是内置的全局变量

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
        // 注册 CORS 插件
        await fastify.register(cors, {
            origin: true,
            credentials: true
        });
        
        const port = process.env.PORT || 57573;
        const host = process.env.HOST || '0.0.0.0';
        
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