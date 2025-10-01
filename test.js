const { Sniffer } = require('./sniffer.cjs');

/**
 * 测试 Sniffer 类的基本功能
 */
async function testSniffer() {
    console.log('🧪 开始测试 Sniffer 类...');
    
    const sniffer = new Sniffer({
        debug: true,
        headless: true
    });

    try {
        // 初始化浏览器
        console.log('📱 初始化浏览器...');
        await sniffer.initBrowser();
        console.log('✅ 浏览器初始化成功');

        // 测试获取页面源码
        console.log('📄 测试获取页面源码...');
        const codeResult = await sniffer.fetCodeByWebView('https://www.baidu.com', {
            timeout: 5000
        });
        console.log('✅ 页面源码获取成功，长度:', codeResult.content.length);
        console.log('⏱️ 耗时:', codeResult.cost);

        // 测试视频嗅探（使用一个简单的测试页面）
        console.log('🎥 测试视频嗅探...');
        const sniffResult = await sniffer.snifferMediaUrl('https://www.w3schools.com/html/html5_video.asp', {
            mode: 1,
            timeout: 8000,
            is_pc: true
        });
        console.log('✅ 嗅探测试完成');
        console.log('📊 结果:', sniffResult);

    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.message);
    } finally {
        // 关闭浏览器
        console.log('🔒 关闭浏览器...');
        await sniffer.close();
        console.log('✅ 浏览器已关闭');
    }
}

/**
 * 测试服务器接口
 */
async function testServer() {
    console.log('🌐 测试服务器接口...');
    
    const baseUrl = 'http://localhost:57573';
    
    try {
        // 测试健康检查
        console.log('💚 测试健康检查接口...');
        const healthResponse = await fetch(`${baseUrl}/health`);
        const healthData = await healthResponse.json();
        console.log('✅ 健康检查:', healthData);

        // 测试活跃状态
        console.log('🔄 测试活跃状态接口...');
        const activeResponse = await fetch(`${baseUrl}/active`);
        const activeData = await activeResponse.json();
        console.log('✅ 活跃状态:', activeData);

        // 测试嗅探接口
        console.log('📡 测试嗅探接口...');
        const snifferUrl = `${baseUrl}/sniffer?url=https://www.w3schools.com/html/html5_video.asp&mode=1&timeout=8000`;
        const snifferResponse = await fetch(snifferUrl);
        const snifferData = await snifferResponse.json();
        console.log('✅ 嗅探接口:', snifferData);

        // 测试页面源码接口
        console.log('📄 测试页面源码接口...');
        const codeUrl = `${baseUrl}/fetCodeByWebView?url=https://www.baidu.com&timeout=5000`;
        const codeResponse = await fetch(codeUrl);
        const codeData = await codeResponse.json();
        console.log('✅ 页面源码接口响应码:', codeData.code);
        console.log('📊 页面内容长度:', codeData.data?.content?.length || 0);

    } catch (error) {
        console.error('❌ 服务器测试失败:', error.message);
        console.log('💡 请确保服务器已启动: npm start');
    }
}

// 主测试函数
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--server')) {
        await testServer();
    } else {
        await testSniffer();
    }
}

main().catch(console.error);