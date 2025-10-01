const puppeteer = require('puppeteer');
const { URL } = require('url');

/**
 * 视频资源嗅探器类
 * 基于 Puppeteer 实现，兼容原 Python 版本的功能
 */
class Sniffer {
    constructor(options = {}) {
        // 默认配置
        this.urlRegex = /http((?!http).){12,}?\.(m3u8|mp4|flv|avi|mkv|rm|wmv|mpg|m4a|mp3)\?.*|http((?!http).){12,}?\.(m3u8|mp4|flv|avi|mkv|rm|wmv|mpg|m4a|mp3)|http((?!http).)*?video\/tos*|http((?!http).)*?obj\/tos*/;
        this.urlNoHead = /http((?!http).){12,}?(ac=dm&url=)/;
        
        this.userAgent = options.userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.50 Safari/537.36';
        this.timeout = options.timeout || 10000;
        this.headTimeout = options.headTimeout || 200;
        this.snifferTimeout = options.snifferTimeout || 20000;
        this.waitTimeout = options.waitTimeout || 3000;
        this.webTimeout = options.webTimeout || 15000;
        
        this.debug = options.debug || false;
        this.customRegex = options.customRegex || null;
        this.headless = options.headless !== false; // 默认无头模式
        this.useChrome = options.useChrome !== false; // 默认使用 Chrome
        this.isPc = options.isPc || false;
        this.headExcludes = options.headExcludes || [];
        this.realUrlExcludes = options.realUrlExcludes || [];
        this.initNewPage = options.initNewPage !== false;
        
        this.browser = null;
        this.context = null;
        this.mainPage = null;
        this.pages = [];
    }

    /**
     * 打印日志
     */
    log(...args) {
        if (this.debug) {
            console.log(...args);
        }
    }

    /**
     * 检查是否可以进行 HEAD 请求
     */
    canHeadCheck(url) {
        for (const exclude of this.headExcludes) {
            if (new RegExp(exclude).test(url)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 检查是否为真实 URL
     */
    isRealUrlCheck(url) {
        for (const exclude of this.realUrlExcludes) {
            if (exclude && new RegExp(exclude).test(url)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 初始化浏览器
     */
    async initBrowser() {
        // 兼容最新 Chrome 版本的启动参数
        const launchArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-field-trial-config',
            '--disable-back-forward-cache',
            '--disable-ipc-flooding-protection',
            '--disable-hang-monitor',
            '--disable-prompt-on-repost',
            '--disable-sync',
            '--disable-domain-reliability',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-component-extensions-with-background-pages',
            '--disable-background-networking',
            '--disable-breakpad',
            '--disable-client-side-phishing-detection',
            '--disable-component-update',
            '--no-default-browser-check',
            '--disable-translate',
            '--disable-logging',
            '--disable-permissions-api',
            '--disable-notifications',
            '--disable-desktop-notifications',
            '--allow-running-insecure-content',
            '--disable-blink-features=AutomationControlled'
        ];

        const launchOptions = {
            headless: this.headless,
            args: launchArgs,
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation'],
            ignoreHTTPSErrors: true
        };

        try {
            // 尝试使用完整参数启动
            this.browser = await puppeteer.launch(launchOptions);
        } catch (e) {
            // 如果失败，尝试简化参数启动
            this.log(`使用完整参数启动失败: ${e.message}，尝试简化参数启动`);
            const simplifiedArgs = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-blink-features=AutomationControlled'
            ];
            
            try {
                this.browser = await puppeteer.launch({
                    ...launchOptions,
                    args: simplifiedArgs
                });
            } catch (e2) {
                // 最后尝试最基本的启动方式
                this.log(`使用简化参数启动失败: ${e2.message}，尝试基本启动`);
                this.browser = await puppeteer.launch({
                    headless: this.headless,
                    ignoreHTTPSErrors: true
                });
            }
        }

        // 创建上下文
        if (!this.isPc) {
            // 模拟移动设备
            const mobileDevice = {
                name: 'iPhone',
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
                viewport: {
                    width: 375,
                    height: 667,
                    deviceScaleFactor: 2,
                    isMobile: true,
                    hasTouch: true,
                    isLandscape: false
                }
            };
            this.context = await this.browser.newPage();
            await this.context.emulate(mobileDevice);
        } else {
            this.context = await this.browser.newPage();
        }

        // 创建主页面
        if (this.initNewPage) {
            this.mainPage = this.context;
        }

        return this.context;
    }

    /**
     * 设置 Cookie
     */
    async setCookie(page, cookie = '') {
        await page.setExtraHTTPHeaders({ 'Cookie': cookie });
    }

    /**
     * 路由拦截器 - 禁止加载某些资源
     */
    static async routeInterceptor(route) {
        const excludedResourceTypes = ['stylesheet', 'image', 'font'];
        const resourceType = route.request().resourceType();
        
        if (excludedResourceTypes.includes(resourceType)) {
            await route.abort();
        } else {
            await route.continue();
        }
    }

    /**
     * 弹窗拦截器
     */
    static async onDialog(dialog) {
        await dialog.accept();
    }

    /**
     * 页面错误拦截器
     */
    static async onPageError(error) {
        // 静默处理页面错误
    }

    /**
     * 创建新页面
     */
    async getPage(headers = null) {
        const page = await this.browser.newPage();
        
        // 设置超时
        page.setDefaultNavigationTimeout(this.timeout);
        page.setDefaultTimeout(this.timeout);

        // 设置用户代理
        if (headers && headers['user-agent']) {
            await page.setUserAgent(headers['user-agent']);
        } else {
            await page.setUserAgent(this.userAgent);
        }

        // 设置请求头
        if (headers) {
            await page.setExtraHTTPHeaders(headers);
        }

        // 注入反检测脚本
        await page.evaluateOnNewDocument(() => {
            // 隐藏 webdriver 特征
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // 修改 plugins 长度
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            // 修改 languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['zh-CN', 'zh', 'en'],
            });
            
            // 修改 permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        });

        // 设置请求拦截
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const url = request.url();
            if (url.match(/\.(png|jpg|jpeg|ttf)$/)) {
                request.abort();
            } else if (url.includes('google.com')) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // 设置事件监听
        page.on('dialog', Sniffer.onDialog);
        page.on('pageerror', Sniffer.onPageError);

        this.pages.push(page);
        return page;
    }

    /**
     * 关闭页面
     */
    async closePage(page) {
        const index = this.pages.indexOf(page);
        if (index > -1) {
            this.pages.splice(index, 1);
        }
        await page.close();
        this.log('成功关闭页面');
    }

    /**
     * 关闭浏览器
     */
    async close() {
        if (this.mainPage && !this.mainPage.isClosed()) {
            await this.mainPage.close();
        }
        if (this.browser) {
            await this.browser.close();
        }
    }

    /**
     * 通过 WebView 获取页面源码
     */
    async fetCodeByWebView(url, options = {}) {
        const startTime = Date.now();
        const {
            headers = null,
            timeout = null,
            isPc = false,
            css = null,
            script = null,
            initScript = null
        } = options;

        const actualTimeout = timeout ? Math.min(timeout, this.webTimeout) : this.timeout;
        const page = await this.getPage(headers);
        
        page.setDefaultNavigationTimeout(actualTimeout);
        page.setDefaultTimeout(actualTimeout);

        const response = {
            content: '',
            headers: { location: url },
            cost: 0
        };

        // 执行初始化脚本
        if (initScript) {
            try {
                this.log(`开始执行页面初始化js: ${initScript}`);
                await page.evaluateOnNewDocument(initScript);
            } catch (e) {
                this.log(`执行页面初始化js发生错误: ${e.message}`);
            }
        }

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
        } catch (e) {
            this.log(`fetCodeByWebView:page.goto 发生了错误: ${e.message}`);
        }

        // 等待 CSS 选择器或页面加载完成
        if (css && css.trim()) {
            try {
                await page.waitForSelector(css.trim());
            } catch (e) {
                this.log(`wait_for_selector发生了错误: ${e.message}`);
            }
        } else {
            try {
                await page.waitForLoadState('load');
            } catch (e) {
                this.log(`wait_for_load_state发生了错误: ${e.message}`);
            }
        }

        // 执行页面脚本
        if (script) {
            try {
                await page.evaluate(script);
                this.log(`网页加载完成后成功执行脚本: ${script}`);
            } catch (e) {
                this.log(`网页加载完成后执行脚本发生错误: ${e.message}`);
            }
        }

        response.content = await page.content();
        response.headers.location = page.url();
        response.cost = `${Date.now() - startTime} ms`;

        await this.closePage(page);
        return response;
    }

    /**
     * 嗅探媒体 URL
     */
    async snifferMediaUrl(playUrl, options = {}) {
        const startTime = Date.now();
        const {
            mode = 0,
            customRegex = null,
            snifferExclude = null,
            timeout = null,
            css = null,
            isPc = false,
            headers = null,
            script = null,
            initScript = null
        } = options;

        const actualCustomRegex = customRegex || this.customRegex;
        const actualIsPc = isPc || this.isPc;
        const doCss = css && css.trim() ? css.trim() : false;

        const realUrls = []; // 真实链接列表
        const headUrls = []; // 已经 head 请求过的链接
        const page = await this.getPage(headers);

        let actualTimeout = timeout || this.timeout;
        if (mode === 1) {
            actualTimeout = Math.min(actualTimeout, this.timeout);
        } else {
            actualTimeout = Math.min(actualTimeout, this.snifferTimeout);
        }

        // 请求拦截器
        const onRequest = async (request) => {
            const url = request.url();
            const method = request.method();
            const requestHeaders = request.headers();
            const resourceType = request.resourceType();
            
            this.log('on_request:', url, ' method:', method, ' resource_type:', resourceType);

            // 检查排除正则
            if (snifferExclude && new RegExp(snifferExclude, 'mi').test(url)) {
                return false;
            }

            // 检查自定义正则
            if (actualCustomRegex && new RegExp(actualCustomRegex, 'mi').test(url)) {
                const _headers = {};
                if (requestHeaders.referer) _headers.referer = requestHeaders.referer;
                if (requestHeaders['user-agent']) _headers['user-agent'] = requestHeaders['user-agent'];

                realUrls.push({ url, headers: _headers });
                
                await page.evaluate(([url, _headers, realUrls]) => {
                    window.realUrl = url;
                    window.realHeaders = _headers;
                    window.realUrls = realUrls;
                }, [url, _headers, realUrls]);

                this.log('on_request通过custom_regex嗅探到真实地址:', url);
                
                if (mode === 0) {
                    page.off('request', onRequest);
                }
                return true;
            }

            // 检查默认正则
            if (this.urlRegex.test(url) && this.isRealUrlCheck(url)) {
                if (url.indexOf('url=http') < 0 && url.indexOf('v=http') < 0 && 
                    url.indexOf('.css') < 0 && url.indexOf('.html') < 0) {
                    
                    const _headers = {};
                    if (requestHeaders.referer) _headers.referer = requestHeaders.referer;
                    if (requestHeaders['user-agent']) _headers['user-agent'] = requestHeaders['user-agent'];

                    realUrls.push({ url, headers: _headers });
                    
                    await page.evaluate(([url, _headers, realUrls]) => {
                        window.realUrl = url;
                        window.realHeaders = _headers;
                        window.realUrls = realUrls;
                    }, [url, _headers, realUrls]);

                    this.log('on_request通过默认正则已嗅探到真实地址:', url);
                    
                    if (mode === 0) {
                        page.off('request', onRequest);
                    }
                    return true;
                }
            } else if (method.toLowerCase() === 'get' && url.startsWith('http') && url !== playUrl) {
                // HEAD 请求检查逻辑
                try {
                    const urlObj = new URL(url);
                    const path = urlObj.pathname;
                    const filename = path.split('/').pop() || '';
                    
                    const shouldCheck = (filename && !filename.includes('.') && !this.urlNoHead.test(url)) ||
                                      (filename.includes('.') && filename.length > 1 && !filename.split('.')[1]);
                    
                    if (shouldCheck && resourceType !== 'script' && 
                        !headUrls.includes(url) && this.canHeadCheck(url)) {
                        
                        try {
                            const response = await page.goto(url, { 
                                method: 'HEAD', 
                                timeout: this.headTimeout 
                            });
                            
                            const responseHeaders = response.headers();
                            
                            if (responseHeaders['content-type'] === 'application/octet-stream' &&
                                responseHeaders['content-disposition'] && 
                                responseHeaders['content-disposition'].includes('.m3u8')) {
                                
                                const _headers = {};
                                if (requestHeaders.referer) _headers.referer = requestHeaders.referer;
                                if (requestHeaders['user-agent']) _headers['user-agent'] = requestHeaders['user-agent'];

                                realUrls.push({ url, headers: _headers });
                                
                                await page.evaluate(([url, _headers, realUrls]) => {
                                    window.realUrl = url;
                                    window.realHeaders = _headers;
                                    window.realUrls = realUrls;
                                }, [url, _headers, realUrls]);

                                this.log('on_request通过head请求嗅探到真实地址:', url);
                                
                                if (mode === 0) {
                                    page.off('request', onRequest);
                                }
                                return true;
                            }
                        } catch (e) {
                            this.log(`head请求访问: ${url} 发生了错误: ${e.message}`);
                        }
                        
                        headUrls.push(url);
                    }
                } catch (e) {
                    this.log(`处理URL时发生错误: ${e.message}`);
                }
            }
            
            return false;
        };

        // 监听请求
        page.on('request', onRequest);
        
        // 设置超时
        page.setDefaultNavigationTimeout(actualTimeout);
        page.setDefaultTimeout(actualTimeout);

        // 暴露 log 函数
        await page.exposeFunction('log', (...args) => console.log(...args));

        // 初始化页面变量
        await page.evaluate(() => {
            window.realUrl = '';
            window.realHeaders = {};
            window.realUrls = [];
        });

        // 执行初始化脚本
        if (initScript) {
            try {
                this.log(`开始执行页面初始化js: ${initScript}`);
                await page.evaluateOnNewDocument(initScript);
            } catch (e) {
                this.log(`执行页面初始化js发生错误: ${e.message}`);
            }
        }

        try {
            await page.goto(playUrl, { waitUntil: 'domcontentloaded' });
        } catch (e) {
            this.log(`snifferMediaUrl:page.goto发生错误: ${e.message}`);
        }

        // 等待 CSS 选择器
        if (doCss) {
            try {
                await page.waitForSelector(doCss);
            } catch (e) {
                this.log(`do_css发生了错误: ${e.message}`);
            }
        }

        // 执行页面脚本
        if (script) {
            if (!doCss) {
                try {
                    await page.waitForLoadState('load');
                } catch (e) {
                    this.log(`wait_for_load_state 发生了错误: ${e.message}`);
                }
            }
            
            try {
                this.log(`开始执行网页js: ${script}`);
                const jsCode = `
                    var scriptTimer;
                    var scriptCounter = 0;
                    scriptTimer = setInterval(function(){
                        if(location.href !== 'about:blank'){
                            scriptCounter += 1;
                            log('---第' + scriptCounter + '次执行script[' + location.href + ']---');
                            ${script}
                            clearInterval(scriptTimer);
                            scriptCounter = 0;
                            log('---执行script成功---');
                        }
                    }, 200);
                `;
                
                await page.evaluateOnNewDocument(jsCode);
                await page.evaluate(jsCode);
                this.log(`网页加载完成后成功执行脚本: ${script}`);
            } catch (e) {
                this.log(`网页加载完成后执行脚本发生错误: ${e.message}`);
            }
        }

        let isTimeout = false;
        
        // 等待结果
        if (mode === 0) {
            try {
                await page.waitForFunction(() => window.realUrl, { timeout: actualTimeout });
            } catch (e) {
                this.log(`page.waitForFunction window.realUrl 发生了错误: ${e.message}`);
                isTimeout = true;
            }
        } else if (mode === 1) {
            try {
                await page.waitForTimeout(actualTimeout);
            } catch (e) {
                this.log(`page.waitForTimeout 发生了错误: ${e.message}`);
                isTimeout = true;
            }
        }

        // 获取结果
        const realUrl = await page.evaluate(() => window.realUrl);
        const realHeaders = await page.evaluate(() => window.realHeaders);
        const realUrlsResult = await page.evaluate(() => window.realUrls);

        const cost = Date.now() - startTime;
        const costStr = `${cost} ms`;
        
        this.log(`共计耗时${cost}毫秒|${isTimeout ? '已超时' : '未超时'}`);
        this.log('realUrl:', realUrl);
        this.log('realHeaders:', realHeaders);

        await this.closePage(page);

        // 返回结果
        if (mode === 0 && realUrl) {
            return {
                url: realUrl,
                headers: realHeaders,
                from: playUrl,
                cost: costStr,
                code: 200,
                script,
                init_script: initScript,
                msg: '超级嗅探解析成功'
            };
        } else if (mode === 1 && realUrlsResult && realUrlsResult.length > 0) {
            return {
                urls: realUrlsResult,
                code: 200,
                from: playUrl,
                cost: costStr,
                script,
                init_script: initScript,
                msg: '超级嗅探解析成功'
            };
        } else {
            return {
                url: realUrl || '',
                headers: realHeaders || {},
                from: playUrl,
                cost: costStr,
                script,
                init_script: initScript,
                code: 404,
                msg: '超级嗅探解析失败'
            };
        }
    }
}

module.exports = { Sniffer };
module.exports.default = Sniffer;