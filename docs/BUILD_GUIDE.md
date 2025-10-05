# 构建指南

本项目提供了多种构建选项来优化最终可执行文件的体积。

## 构建选项

### 1. 标准构建 (GZip 压缩)
```bash
npm run build:all
```
- 使用 GZip 压缩
- 兼容性最好
- 体积适中

### 2. Brotli 压缩构建
```bash
npm run build:brotli
```
- 使用 Brotli 压缩
- 比 GZip 体积更小
- 压缩率更高

### 3. 轻量级构建
```bash
npm run build:lite
```
- 使用 Brotli 压缩
- 禁用字节码缓存 (`--no-bytecode`)
- 公开所有包 (`--public-packages=*`)
- 体积最小

### 4. 迷你构建
```bash
npm run build:mini
```
- 最激进的压缩选项
- 添加 `--no-warnings` 选项
- 体积最小，但可能需要更多运行时依赖

### 5. 优化构建 (推荐)
```bash
npm run build:optimized
```
- 自动构建多个版本
- 提供详细的体积统计
- 包含标准版和迷你版

## 体积优化技术

### 1. 压缩算法
- **GZip**: 标准压缩，兼容性好
- **Brotli**: 更高压缩率，体积更小

### 2. PKG 选项
- `--no-bytecode`: 禁用字节码缓存，减少体积
- `--public-packages=*`: 将所有包标记为公开，减少包装开销
- `--no-warnings`: 禁用警告，减少输出体积

### 3. 资源排除
- 使用 `.pkgignore` 文件排除不必要的文件
- 移除了大部分 Puppeteer Chromium 文件
- 排除开发和测试文件

### 4. 依赖优化
- 只包含必要的运行时文件
- 排除文档、测试和示例文件
- 移除 TypeScript 定义文件

## 文件说明

- `.pkgignore`: 定义打包时要排除的文件和目录
- `build-optimized.js`: 优化构建脚本，提供详细统计
- `BUILD_GUIDE.md`: 本构建指南

## 使用建议

1. **开发测试**: 使用 `npm run build:win` (或对应平台)
2. **生产部署**: 使用 `npm run build:optimized`
3. **极限压缩**: 使用 `npm run build:mini`

## 注意事项

- 迷你版本可能在某些环境下需要额外的运行时依赖
- Brotli 压缩的文件启动时间可能稍长
- 建议在目标环境中测试压缩版本的兼容性