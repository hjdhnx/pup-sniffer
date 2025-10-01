# Pup Sniffer

基于 Puppeteer 和 Fastify 的视频资源嗅探器 Node.js 版本。

## 功能特性

- 🎯 视频资源嗅探（支持 m3u8、mp4 等格式）
- 🌐 页面源码获取
- 📱 支持 PC 和移动设备模拟
- 🔧 自定义正则表达式匹配
- 🚀 高性能 Fastify 服务器
- 🎨 现代化 Web 演示界面
- 📦 支持打包成二进制文件，无需安装 Node.js

## 快速开始

### 方式一：使用二进制文件（推荐）

1. 下载对应平台的二进制文件：
   - Windows: `pup-sniffer-win.exe`
   - Linux: `pup-sniffer-linux`
   - macOS (Intel): `pup-sniffer-macos`
   - macOS (Apple Silicon): `pup-sniffer-macos-arm64`

2. 将 `demo.html` 文件放在二进制文件同一目录下

3. 直接运行二进制文件：
   ```bash
   # Windows
   ./pup-sniffer-win.exe
   
   # Linux/macOS
   ./pup-sniffer-linux
   ./pup-sniffer-macos
   ```

### 方式二：从源码运行

1. 安装依赖：
   ```bash
   npm install
   ```

2. 启动服务：
   ```bash
   npm start
   ```

服务将在 http://localhost:57573 启动

## 构建二进制文件

### 构建所有平台
```bash
npm run build
```

### 构建特定平台

[打包工具pkg安装参考](https://www.jb51.net/javascript/329845uie.htm)

```bash
# Windows x64
npm run build:win

# Linux x64
npm run build:linux

# macOS x64
npm run build:macos

# macOS ARM64
npm run build:macos-arm
```

构建完成后，二进制文件将输出到 `dist/` 目录。

## API 接口

### 1. 视频嗅探接口

**GET** `/sniffer`

#### 请求参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| url | string | ✅ | 要嗅探的页面 URL |
| mode | string | ❌ | 嗅探模式：0=单个链接，1=多个链接（默认：0） |
| is_pc | string | ❌ | 是否模拟 PC：0=移动设备，1=PC（默认：0） |
| timeout | string | ❌ | 超时时间（毫秒，默认：10000） |
| css | string | ❌ | 等待的 CSS 选择器 |
| script | string | ❌ | 页面执行脚本（Base64 编码） |
| init_script | string | ❌ | 页面初始化脚本（Base64 编码） |
| headers | string | ❌ | 自定义请求头（换行分隔） |
| custom_regex | string | ❌ | 自定义匹配正则表达式 |
| sniffer_exclude | string | ❌ | 排除匹配的正则表达式 |

#### 响应示例

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "url": "https://example.com/video.m3u8",
    "headers": {
      "referer": "https://example.com",
      "user-agent": "Mozilla/5.0..."
    },
    "from": "https://example.com/play",
    "cost": "2345 ms",
    "code": 200,
    "msg": "超级嗅探解析成功"
  },
  "timestamp": 1703123456789
}
```

### 2. 页面源码获取接口

**GET** `/fetCodeByWebView`

#### 请求参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| url | string | ✅ | 要获取源码的页面 URL |
| is_pc | string | ❌ | 是否模拟 PC：0=移动设备，1=PC（默认：0） |
| timeout | string | ❌ | 超时时间（毫秒，默认：10000） |
| css | string | ❌ | 等待的 CSS 选择器 |
| script | string | ❌ | 页面执行脚本（Base64 编码） |
| init_script | string | ❌ | 页面初始化脚本（Base64 编码） |
| headers | string | ❌ | 自定义请求头（换行分隔） |

#### 响应示例

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "content": "<!DOCTYPE html><html>...</html>",
    "headers": {
      "location": "https://example.com"
    },
    "cost": "1234 ms"
  },
  "timestamp": 1703123456789
}
```

### 3. 健康检查接口

**GET** `/health`

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "status": "ok",
    "service": "pup-sniffer"
  },
  "timestamp": 1703123456789
}
```

### 4. 活跃状态接口

**GET** `/active`

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "active": true,
    "browser": "initialized",
    "timestamp": "2023-12-21T10:30:56.789Z"
  },
  "timestamp": 1703123456789
}
```

## 使用示例

### 基本嗅探

```bash
curl "http://localhost:57573/sniffer?url=https://example.com/play"
```

### 多链接嗅探

```bash
curl "http://localhost:57573/sniffer?url=https://example.com/play&mode=1&timeout=15000"
```

### PC 模式嗅探

```bash
curl "http://localhost:57573/sniffer?url=https://example.com/play&is_pc=1"
```

### 自定义脚本嗅探

```bash
# script 需要 Base64 编码
script_b64=$(echo "console.log('test')" | base64)
curl "http://localhost:57573/sniffer?url=https://example.com/play&script=$script_b64"
```

### 获取页面源码

```bash
curl "http://localhost:57573/fetCodeByWebView?url=https://example.com"
```

## 测试

```bash
# 测试 Sniffer 类
npm test

# 测试服务器接口（需要先启动服务）
npm run test:server
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 57573 |
| HOST | 服务主机 | 0.0.0.0 |

## 注意事项

1. **Chrome 依赖**: 需要系统安装 Chrome 浏览器
2. **内存使用**: Puppeteer 会消耗较多内存，建议在生产环境中监控资源使用
3. **超时设置**: 建议根据目标网站的加载速度合理设置超时时间
4. **并发限制**: 当前版本使用单个浏览器实例，高并发场景下可能需要优化

## 故障排除

### Chrome 启动失败

如果遇到 Chrome 启动失败，可以尝试：

1. 确保系统已安装 Chrome 浏览器
2. 检查系统权限和沙箱设置
3. 查看服务器日志获取详细错误信息

### 嗅探失败

如果嗅探失败，可以：

1. 增加超时时间
2. 检查目标网站是否有反爬虫机制
3. 尝试使用自定义正则表达式
4. 启用调试模式查看详细日志

## 开发

项目采用 ESM 模块化开发，主要文件：

- `sniffer.js`: 核心嗅探类
- `server.js`: Fastify 服务器
- `test.js`: 测试脚本
- `package.json`: 项目配置

## 许可证

MIT License