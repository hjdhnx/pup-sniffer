# Pup Sniffer

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)](https://github.com)

基于 Puppeteer 和 Fastify 的视频资源嗅探器 Node.js 版本。

> 🎯 **高性能视频资源嗅探工具**，支持多平台部署，提供完整的 API 接口和现代化 Web 界面。

## 📋 目录

- [功能特性](#功能特性)
- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [构建二进制文件](#构建二进制文件)
- [API 接口](#api-接口)
- [使用示例](#使用示例)
- [测试](#测试)
- [命令行参数](#命令行参数)
- [环境变量](#环境变量)
- [注意事项](#注意事项)
- [故障排除](#故障排除)
- [文档](#文档)
- [开发](#开发)
- [许可证](#许可证)

## 功能特性

- 🎯 视频资源嗅探（支持 m3u8、mp4 等格式）
- 🌐 页面源码获取
- 📱 支持 PC 和移动设备模拟
- 🔧 自定义正则表达式匹配
- 🚀 高性能 Fastify 服务器
- 🎨 现代化 Web 演示界面
- 📦 支持打包成二进制文件，无需安装 Node.js

## 系统要求

- **Chrome 浏览器**: 系统需要安装 Chrome 浏览器（Puppeteer 依赖）
- **Node.js**: 从源码运行需要 Node.js >= 18.0.0
- **操作系统**: 支持 Windows、Linux、macOS

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
   # Windows - 默认端口启动
   ./pup-sniffer-win.exe
   
   # Windows - 指定端口启动
   ./pup-sniffer-win.exe -port 8080
   
   # Linux/macOS - 默认端口启动
   ./pup-sniffer-linux
   ./pup-sniffer-macos
   
   # Linux/macOS - 指定端口启动
   ./pup-sniffer-linux -port 8080
   ./pup-sniffer-macos -port 8080
   
   # 查看帮助信息
   ./pup-sniffer-win.exe --help
   ```

### 方式二：从源码运行

1. 安装依赖：
   ```bash
   npm install
   ```

2. 启动服务：
   ```bash
   # 默认端口启动（自动查找可用端口，从57573开始）
   npm start
   
   # 或直接使用 node 命令
   node server.cjs
   
   # 指定端口启动
   node server.cjs -port 8080
   
   # 查看帮助信息
   node server.cjs --help
   ```

服务默认在 http://localhost:57573 启动（如果端口被占用会自动查找下一个可用端口）

## 构建二进制文件

项目提供了多种构建选项，支持不同的压缩算法和优化级别，以满足不同的使用需求。

### 📦 构建选项概览

| 构建类型 | 压缩算法 | 体积优化 | 适用场景 |
|----------|----------|----------|----------|
| 标准版 | GZip | 中等 | 通用部署 |
| Brotli版 | Brotli | 较高 | 网络传输优化 |
| 轻量版 | Brotli | 高 | 资源受限环境 |
| 迷你版 | Brotli | 最高 | 极致体积要求 |

### 🚀 快速构建

```bash
# 构建所有平台（标准版，GZip压缩）
npm run build

# 构建优化版本（推荐，包含多种压缩选项）
npm run build:optimized

# 构建迷你版本（最小体积，所有平台）
npm run build:mini
```

### 🎯 平台特定构建

#### 标准版本（GZip 压缩）
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

#### Brotli 压缩版本（更小体积）
```bash
# Windows x64
npm run build:win:brotli

# Linux x64
npm run build:linux:brotli

# macOS x64
npm run build:macos:brotli

# macOS ARM64
npm run build:macos-arm:brotli
```

#### 轻量版本（优化选项）
```bash
# Windows x64
npm run build:win:lite

# Linux x64
npm run build:linux:lite

# macOS x64
npm run build:macos:lite

# macOS ARM64
npm run build:macos-arm:lite
```

#### 迷你版本（最小体积）
```bash
# Windows x64
npm run build:win:mini

# Linux x64
npm run build:linux:mini

# macOS x64
npm run build:macos:mini

# macOS ARM64
npm run build:macos-arm:mini
```

### ⚙️ 构建优化技术

项目采用了多种优化技术来减小打包体积：

1. **压缩算法**：
   - **GZip**：标准压缩，兼容性好
   - **Brotli**：更高压缩率，体积减少 10-15%

2. **PKG 优化选项**：
   - `--no-bytecode`：禁用字节码缓存
   - `--public-packages=*`：减少包装开销
   - `--no-warnings`：减少输出体积

3. **资源排除**：
   - 通过 `.pkgignore` 排除开发、测试、文档文件
   - 排除大型依赖的非必要部分
   - 智能排除开发环境专用模块

4. **智能配置**：
   - 生产环境自动禁用 `pino-pretty` 日志美化
   - 动态检测运行环境，优化资源加载

### 📊 体积对比

以 Windows x64 版本为例：

| 版本类型 | 文件大小 | 压缩率 | 说明 |
|----------|----------|--------|------|
| 标准版 | ~46 MB | - | GZip 压缩 |
| Brotli版 | ~44 MB | -4% | Brotli 压缩 |
| 轻量版 | ~42 MB | -9% | Brotli + 优化选项 |
| 迷你版 | ~41 MB | -11% | 最大优化 |

### 🛠️ 高级构建

如需更多自定义选项，可以使用优化构建脚本：

```bash
# 运行优化构建脚本（包含所有选项）
node build-optimized.js

# 查看详细构建指南
cat docs/BUILD_GUIDE.md
```

### 📋 构建要求

[打包工具pkg安装参考](https://www.jb51.net/javascript/329845uie.htm)

**系统要求**：
- Node.js >= 18.0.0
- npm 或 yarn
- 足够的磁盘空间（构建过程需要约 200MB 临时空间）

**依赖安装**：
```bash
# 安装构建依赖
npm install

# 全局安装 pkg（可选，项目已包含）
npm install -g pkg
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

**注意**：以下示例使用默认端口 57573，如果您使用了 `-port` 参数指定了其他端口，请相应调整 URL 中的端口号。

### 基本嗅探

```bash
# 默认端口
curl "http://localhost:57573/sniffer?url=https://example.com/play"

# 自定义端口（如果使用 -port 8080 启动）
curl "http://localhost:8080/sniffer?url=https://example.com/play"
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
# 运行测试脚本
npm test
```

**注意**: 测试前请确保服务器已启动 (`npm start`)。

## 命令行参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `-port <端口号>` | 指定服务器端口号 (1-65535) | `-port 8080` |
| `-h, --help` | 显示帮助信息 | `--help` |

**端口说明**：
- 如果不指定端口号，程序将从 57573 开始自动查找可用端口
- 如果指定的端口被占用，程序会报错并退出
- 端口号必须在 1-65535 范围内

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| HOST | 服务主机地址 | 0.0.0.0 |

**注意**: 端口配置请使用 `-port` 命令行参数，不支持通过环境变量设置端口。

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

## 📚 文档

- [API 文档](docs/API_DOCS.md) - 详细的 API 接口说明
- [构建指南](docs/BUILD_GUIDE.md) - 完整的构建配置和优化说明

## 🔧 开发

项目采用 CommonJS 模块化开发，主要文件：

- `sniffer.cjs`: 核心嗅探类
- `server.cjs`: Fastify 服务器  
- `test.js`: 测试脚本
- `package.json`: 项目配置
- `build-optimized.js`: 优化构建脚本
- `.pkgignore`: 打包排除文件配置

### 开发环境设置

```bash
# 克隆项目
git clone <repository-url>
cd pup-sniffer

# 安装依赖
npm install

# 启动开发服务器
npm start

# 运行测试
npm test
```

### 代码贡献

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

MIT License