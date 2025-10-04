# Pup Sniffer - Golang 版本

基于 [go-rod](https://github.com/go-rod/rod) 的视频资源嗅探器 Golang 实现。

## 功能特性

- 🎯 **媒体嗅探**: 自动检测和提取网页中的视频/音频资源 URL
- 🌐 **多模式支持**: 支持单个 URL 嗅探和批量 URL 收集
- 📱 **设备模拟**: 支持 PC 和移动设备模拟
- 🔧 **自定义脚本**: 支持页面初始化脚本和执行脚本
- 📄 **页面源码**: 获取动态渲染后的页面 HTML 源码
- ⚡ **高性能**: 基于 Chrome DevTools Protocol，性能优异
- 🛡️ **反检测**: 内置反自动化检测机制

## 系统要求

- Go >= 1.21
- Chrome 浏览器 (用于 go-rod)
- 支持 Windows、Linux、macOS

## 快速开始

### 1. 安装依赖

```bash
cd golang
go mod tidy
```

### 2. 运行服务

```bash
# 使用默认端口 (自动查找可用端口，从 57573 开始)
go run .

# 指定端口
go run . -port 8080

# 查看帮助
go run . -help
```

### 3. 编译可执行文件

```bash
# 编译当前平台
go build -o pup-sniffer .

# 交叉编译 Windows
GOOS=windows GOARCH=amd64 go build -o pup-sniffer.exe .

# 交叉编译 Linux
GOOS=linux GOARCH=amd64 go build -o pup-sniffer-linux .
```

## API 接口

### 1. 媒体嗅探接口

**GET** `/sniffer`

**参数:**
- `url` (必需): 目标页面 URL
- `mode` (可选): 嗅探模式
  - `0`: 单个 URL 模式 (找到第一个匹配的 URL 后立即返回)
  - `1`: 批量 URL 模式 (收集所有匹配的 URL)
- `is_pc` (可选): 设备模式
  - `0`: 移动设备模拟 (默认)
  - `1`: PC 设备模拟
- `timeout` (可选): 超时时间，单位毫秒 (默认: 10000，最大: 60000)
- `custom_regex` (可选): 自定义正则表达式
- `sniffer_exclude` (可选): 排除正则表达式
- `css` (可选): CSS 选择器，等待元素出现
- `script` (可选): 页面脚本 (Base64 编码)
- `init_script` (可选): 初始化脚本 (Base64 编码)
- `headers` (可选): 自定义请求头，格式为 "key: value" 每行一个

**示例:**
```bash
curl "http://localhost:57573/sniffer?url=https://example.com&mode=0&timeout=10000"
```

### 2. 页面源码接口

**GET** `/fetCodeByWebView`

获取动态渲染后的页面 HTML 源码。

**参数:** 与嗅探接口相同 (除了 `mode`, `custom_regex`, `sniffer_exclude`)

**示例:**
```bash
curl "http://localhost:57573/fetCodeByWebView?url=https://example.com&timeout=10000"
```

### 3. 健康检查接口

**GET** `/health`

检查服务状态。

### 4. 活跃状态接口

**GET** `/active`

检查服务和浏览器状态。

## 响应格式

所有接口都返回统一的 JSON 格式：

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    // 具体数据
  },
  "timestamp": 1640995200000
}
```

### 嗅探成功响应 (mode=0)

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
    "from": "https://example.com",
    "cost": "2500 ms",
    "total_cost": "2600 ms",
    "code": 200,
    "msg": "超级嗅探解析成功"
  }
}
```

### 嗅探成功响应 (mode=1)

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "urls": [
      {
        "url": "https://example.com/video1.m3u8",
        "headers": {
          "referer": "https://example.com"
        }
      },
      {
        "url": "https://example.com/video2.mp4",
        "headers": {
          "referer": "https://example.com"
        }
      }
    ],
    "from": "https://example.com",
    "cost": "5000 ms",
    "total_cost": "5100 ms",
    "code": 200,
    "msg": "超级嗅探解析成功"
  }
}
```

## 配置说明

### 默认配置

```go
config := &SnifferConfig{
    Debug:          true,     // 启用调试日志
    Headless:       true,     // 无头模式
    UseChrome:      true,     // 使用系统 Chrome
    DeviceType:     "mobile", // 默认移动设备
    Timeout:        30000,    // 默认超时 30 秒
    SnifferTimeout: 10000,    // 嗅探超时 10 秒
    HeadTimeout:    5000,     // HEAD 请求超时 5 秒
    ConcurrencyNum: 3,        // 并发数
}
```

### 环境变量

- `HOST`: 服务器监听地址 (默认: 0.0.0.0)

## 与 Node.js 版本的差异

1. **性能**: Golang 版本在并发处理和内存使用方面更优
2. **部署**: 编译后的二进制文件更容易部署，无需 Node.js 环境
3. **依赖**: 使用 go-rod 替代 puppeteer，功能基本一致
4. **API**: 保持与原版 100% 兼容的 API 接口

## 故障排除

### 1. Chrome 未找到

确保系统已安装 Chrome 浏览器，或者设置 `UseChrome: false` 使用内置浏览器。

### 2. 端口被占用

使用 `-port` 参数指定其他端口，或让程序自动查找可用端口。

### 3. 超时问题

根据目标网站的加载速度调整 `timeout` 参数。

### 4. 嗅探失败

- 检查目标 URL 是否可访问
- 尝试使用自定义正则表达式
- 检查是否需要特殊的请求头或脚本

## 开发说明

### 项目结构

```
golang/
├── go.mod          # Go 模块文件
├── sniffer.go      # 嗅探器核心实现
├── server.go       # HTTP 服务器实现
└── README.md       # 说明文档
```

### 核心组件

1. **Sniffer**: 嗅探器核心，基于 go-rod 实现
2. **Server**: HTTP 服务器，基于 Gin 框架
3. **APIResponse**: 统一的响应格式

## 许可证

与主项目保持一致的许可证。