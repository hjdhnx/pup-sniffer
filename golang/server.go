package main

import (
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

// APIResponse 统一响应格式
type APIResponse struct {
	Code      int         `json:"code"`
	Msg       string      `json:"msg"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp int64       `json:"timestamp"`
}

// Server HTTP 服务器
type Server struct {
	sniffer *Sniffer
	engine  *gin.Engine
	port    int
	host    string
}

// NewServer 创建新的服务器实例
func NewServer() *Server {
	// 设置 Gin 模式
	gin.SetMode(gin.ReleaseMode)

	server := &Server{
		engine: gin.New(),
		host:   "0.0.0.0",
	}

	// 添加中间件
	server.engine.Use(gin.Logger())
	server.engine.Use(gin.Recovery())
	server.engine.Use(corsMiddleware())

	// 设置路由
	server.setupRoutes()

	return server
}

// corsMiddleware CORS 中间件
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// setupRoutes 设置路由
func (s *Server) setupRoutes() {
	// 首页路由
	s.engine.GET("/", s.handleHome)

	// 健康检查接口
	s.engine.GET("/health", s.handleHealth)

	// 活跃状态接口
	s.engine.GET("/active", s.handleActive)

	// 主要的嗅探接口
	s.engine.GET("/sniffer", s.handleSniffer)

	// 获取页面源码接口
	s.engine.GET("/fetCodeByWebView", s.handleFetCodeByWebView)
}

// createResponse 创建统一响应
func createResponse(data interface{}, code int, msg string) *APIResponse {
	return &APIResponse{
		Code:      code,
		Msg:       msg,
		Data:      data,
		Timestamp: time.Now().UnixMilli(),
	}
}

// createErrorResponse 创建错误响应
func createErrorResponse(msg string, code int) *APIResponse {
	return createResponse(nil, code, msg)
}

// handleHome 首页处理器
func (s *Server) handleHome(c *gin.Context) {
	// 简单的演示页面
	html := `<!DOCTYPE html>
<html>
<head>
    <title>Pup Sniffer - Golang Version</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .api-item { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .method { color: #28a745; font-weight: bold; }
        .url { color: #007bff; font-family: monospace; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🐶 Pup Sniffer - Golang Version</h1>
        <p>视频资源嗅探器 - 基于 go-rod 的 Golang 实现</p>
        
        <h2>API 接口</h2>
        
        <div class="api-item">
            <h3><span class="method">GET</span> <span class="url">/sniffer</span></h3>
            <p>媒体嗅探接口</p>
            <p><strong>参数:</strong></p>
            <ul>
                <li><code>url</code> - 目标页面 URL (必需)</li>
                <li><code>mode</code> - 嗅探模式 (0: 单个URL, 1: 批量URL)</li>
                <li><code>is_pc</code> - 是否使用PC模式 (0: 移动端, 1: PC端)</li>
                <li><code>timeout</code> - 超时时间 (毫秒)</li>
                <li><code>custom_regex</code> - 自定义正则表达式</li>
                <li><code>sniffer_exclude</code> - 排除正则表达式</li>
                <li><code>css</code> - CSS 选择器</li>
                <li><code>script</code> - 页面脚本 (Base64编码)</li>
                <li><code>init_script</code> - 初始化脚本 (Base64编码)</li>
                <li><code>headers</code> - 请求头</li>
            </ul>
        </div>
        
        <div class="api-item">
            <h3><span class="method">GET</span> <span class="url">/fetCodeByWebView</span></h3>
            <p>获取页面源码接口</p>
            <p><strong>参数:</strong> 与 /sniffer 接口相同</p>
        </div>
        
        <div class="api-item">
            <h3><span class="method">GET</span> <span class="url">/health</span></h3>
            <p>健康检查接口</p>
        </div>
        
        <div class="api-item">
            <h3><span class="method">GET</span> <span class="url">/active</span></h3>
            <p>活跃状态检查接口</p>
        </div>
        
        <h2>示例</h2>
        <pre>curl "http://localhost:57573/sniffer?url=https://example.com&mode=0&timeout=10000"</pre>
    </div>
</body>
</html>`

	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, html)
}

// handleHealth 健康检查处理器
func (s *Server) handleHealth(c *gin.Context) {
	data := map[string]interface{}{
		"status":  "ok",
		"service": "pup-sniffer-golang",
	}
	c.JSON(http.StatusOK, createResponse(data, 200, "success"))
}

// handleActive 活跃状态处理器
func (s *Server) handleActive(c *gin.Context) {
	browserStatus := "not_initialized"
	if s.sniffer != nil && s.sniffer.browser != nil {
		browserStatus = "initialized"
	}

	data := map[string]interface{}{
		"active":    true,
		"browser":   browserStatus,
		"timestamp": time.Now().Format(time.RFC3339),
	}
	c.JSON(http.StatusOK, createResponse(data, 200, "success"))
}

// handleSniffer 嗅探处理器
func (s *Server) handleSniffer(c *gin.Context) {
	startTime := time.Now()

	// 获取请求参数
	targetURL := c.Query("url")
	isPcStr := c.DefaultQuery("is_pc", "0")
	css := c.Query("css")
	script := c.Query("script")
	initScript := c.Query("init_script")
	headers := c.Query("headers")
	timeoutStr := c.DefaultQuery("timeout", "10000")
	customRegex := c.Query("custom_regex")
	snifferExclude := c.Query("sniffer_exclude")
	modeStr := c.DefaultQuery("mode", "0")

	// 验证必需参数
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, createErrorResponse("缺少必需参数: url", 400))
		return
	}

	if !isValidURL(targetURL) {
		c.JSON(http.StatusBadRequest, createErrorResponse("无效的 URL 格式", 400))
		return
	}

	// 解析参数
	var parsedScript, parsedInitScript string
	var parsedHeaders map[string]string
	var parsedTimeout, parsedMode int
	var parsedIsPc bool

	// 解码 Base64 脚本
	if script != "" {
		if decoded, err := base64.StdEncoding.DecodeString(script); err == nil {
			parsedScript = string(decoded)
		} else {
			log.Printf("解码 script 失败: %v", err)
			parsedScript = script
		}
	}

	if initScript != "" {
		if decoded, err := base64.StdEncoding.DecodeString(initScript); err == nil {
			parsedInitScript = string(decoded)
		} else {
			log.Printf("解码 init_script 失败: %v", err)
			parsedInitScript = initScript
		}
	}

	// 解析请求头
	parsedHeaders = parseHeaders(headers)

	// 解析超时时间
	if timeout, err := strconv.Atoi(timeoutStr); err == nil {
		parsedTimeout = timeout
		if parsedTimeout > 60000 {
			parsedTimeout = 60000 // 最大 60 秒
		}
	} else {
		parsedTimeout = 10000
	}

	// 解析模式
	if mode, err := strconv.Atoi(modeStr); err == nil {
		parsedMode = mode
	} else {
		parsedMode = 0
	}

	// 解析是否为 PC
	parsedIsPc = isPcStr == "1" || isPcStr == "true"

	// 初始化 Sniffer
	if err := s.initSniffer(); err != nil {
		c.JSON(http.StatusInternalServerError, createErrorResponse(fmt.Sprintf("初始化嗅探器失败: %v", err), 500))
		return
	}

	// 执行嗅探
	options := &SnifferOptions{
		Mode:           parsedMode,
		CustomRegex:    customRegex,
		SnifferExclude: snifferExclude,
		Timeout:        parsedTimeout,
		CSS:            css,
		IsPc:           parsedIsPc,
		Headers:        parsedHeaders,
		Script:         parsedScript,
		InitScript:     parsedInitScript,
	}

	result, err := s.sniffer.SnifferMediaURL(targetURL, options)
	if err != nil {
		log.Printf("嗅探过程中发生错误: %v", err)
		c.JSON(http.StatusInternalServerError, createErrorResponse(fmt.Sprintf("嗅探失败: %v", err), 500))
		return
	}

	totalCost := time.Since(startTime)
	if result != nil {
		// 添加总耗时信息
		resultMap := make(map[string]interface{})
		resultBytes, _ := json.Marshal(result)
		json.Unmarshal(resultBytes, &resultMap)
		resultMap["total_cost"] = fmt.Sprintf("%d ms", totalCost.Milliseconds())
		
		c.JSON(http.StatusOK, createResponse(resultMap, 200, "success"))
	} else {
		c.JSON(http.StatusInternalServerError, createErrorResponse("嗅探返回空结果", 500))
	}
}

// handleFetCodeByWebView 获取页面源码处理器
func (s *Server) handleFetCodeByWebView(c *gin.Context) {
	startTime := time.Now()

	// 获取请求参数
	targetURL := c.Query("url")
	isPcStr := c.DefaultQuery("is_pc", "0")
	css := c.Query("css")
	script := c.Query("script")
	initScript := c.Query("init_script")
	headers := c.Query("headers")
	timeoutStr := c.DefaultQuery("timeout", "10000")

	// 验证必需参数
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, createErrorResponse("缺少必需参数: url", 400))
		return
	}

	if !isValidURL(targetURL) {
		c.JSON(http.StatusBadRequest, createErrorResponse("无效的 URL 格式", 400))
		return
	}

	// 解析参数
	var parsedScript, parsedInitScript string
	var parsedHeaders map[string]string
	var parsedTimeout int
	var parsedIsPc bool

	// 解码 Base64 脚本
	if script != "" {
		if decoded, err := base64.StdEncoding.DecodeString(script); err == nil {
			parsedScript = string(decoded)
		} else {
			log.Printf("解码 script 失败: %v", err)
			parsedScript = script
		}
	}

	if initScript != "" {
		if decoded, err := base64.StdEncoding.DecodeString(initScript); err == nil {
			parsedInitScript = string(decoded)
		} else {
			log.Printf("解码 init_script 失败: %v", err)
			parsedInitScript = initScript
		}
	}

	// 解析请求头
	parsedHeaders = parseHeaders(headers)

	// 解析超时时间
	if timeout, err := strconv.Atoi(timeoutStr); err == nil {
		parsedTimeout = timeout
		if parsedTimeout > 60000 {
			parsedTimeout = 60000 // 最大 60 秒
		}
	} else {
		parsedTimeout = 10000
	}

	// 解析是否为 PC
	parsedIsPc = isPcStr == "1" || isPcStr == "true"

	// 初始化 Sniffer
	if err := s.initSniffer(); err != nil {
		c.JSON(http.StatusInternalServerError, createErrorResponse(fmt.Sprintf("初始化嗅探器失败: %v", err), 500))
		return
	}

	// 获取页面源码
	options := &SnifferOptions{
		Timeout:    parsedTimeout,
		CSS:        css,
		IsPc:       parsedIsPc,
		Headers:    parsedHeaders,
		Script:     parsedScript,
		InitScript: parsedInitScript,
	}

	result, err := s.sniffer.FetCodeByWebView(targetURL, options)
	if err != nil {
		log.Printf("获取页面源码过程中发生错误: %v", err)
		c.JSON(http.StatusInternalServerError, createErrorResponse(fmt.Sprintf("获取页面源码失败: %v", err), 500))
		return
	}

	totalCost := time.Since(startTime)
	if result != nil {
		// 添加总耗时信息
		resultMap := make(map[string]interface{})
		resultBytes, _ := json.Marshal(result)
		json.Unmarshal(resultBytes, &resultMap)
		resultMap["total_cost"] = fmt.Sprintf("%d ms", totalCost.Milliseconds())
		
		c.JSON(http.StatusOK, createResponse(resultMap, 200, "success"))
	} else {
		c.JSON(http.StatusInternalServerError, createErrorResponse("获取页面源码返回空结果", 500))
	}
}

// initSniffer 初始化嗅探器
func (s *Server) initSniffer() error {
	if s.sniffer == nil {
		log.Println("开始初始化嗅探器...")
		config := &SnifferConfig{
			Debug:     true,
			Headless:  true,
			UseChrome: true,
		}
		s.sniffer = NewSniffer(config)
		err := s.sniffer.InitBrowser()
		if err != nil {
			log.Printf("浏览器初始化失败: %v", err)
			return err
		}
		log.Println("嗅探器初始化完成")
	}
	return nil
}

// isValidURL 验证 URL 格式
func isValidURL(urlStr string) bool {
	_, err := url.Parse(urlStr)
	return err == nil && (strings.HasPrefix(urlStr, "http://") || strings.HasPrefix(urlStr, "https://"))
}

// parseHeaders 解析请求头字符串
func parseHeaders(headerStr string) map[string]string {
	headers := make(map[string]string)
	if headerStr == "" {
		return headers
	}

	lines := strings.Split(headerStr, "\n")
	for _, line := range lines {
		colonIndex := strings.Index(line, ":")
		if colonIndex > 0 {
			key := strings.TrimSpace(strings.ToLower(line[:colonIndex]))
			value := strings.TrimSpace(line[colonIndex+1:])
			if key != "" && value != "" {
				headers[key] = value
			}
		}
	}

	return headers
}

// checkPortAvailable 检查端口是否可用
func checkPortAvailable(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return false
	}
	ln.Close()
	return true
}

// findAvailablePort 查找可用端口
func findAvailablePort(startPort int) (int, error) {
	for port := startPort; port < startPort+100; port++ {
		if checkPortAvailable(port) {
			return port, nil
		}
	}
	return 0, fmt.Errorf("无法找到可用端口，已尝试从 %d 到 %d", startPort, startPort+99)
}

// showHelp 显示帮助信息
func showHelp() {
	fmt.Println(`
Pup Sniffer - 视频资源嗅探器 (Golang版本)

使用方法:
  go run . [选项]
  ./pup-sniffer [选项]

选项:
  -port <端口号>    指定服务器端口号 (1-65535)
  -h, -help        显示此帮助信息

示例:
  go run . -port 8080
  ./pup-sniffer -port 3000

如果不指定端口号，服务器将从57573开始自动查找可用端口。
`)
}

// Start 启动服务器
func (s *Server) Start() error {
	// 解析命令行参数
	var port int
	var help bool

	flag.IntVar(&port, "port", 0, "指定服务器端口号")
	flag.BoolVar(&help, "h", false, "显示帮助信息")
	flag.BoolVar(&help, "help", false, "显示帮助信息")
	flag.Parse()

	// 如果请求帮助，显示帮助信息并退出
	if help {
		showHelp()
		return nil
	}

	// 确定使用的端口
	if port != 0 {
		// 使用指定的端口
		if !checkPortAvailable(port) {
			return fmt.Errorf("指定的端口 %d 已被占用", port)
		}
		s.port = port
		fmt.Printf("使用指定端口: %d\n", port)
	} else {
		// 自动查找可用端口
		fmt.Println("正在查找可用端口...")
		availablePort, err := findAvailablePort(57573)
		if err != nil {
			return err
		}
		s.port = availablePort
		fmt.Printf("找到可用端口: %d\n", availablePort)
	}

	// 设置优雅关闭
	go s.setupGracefulShutdown()

	// 启动服务器
	addr := fmt.Sprintf("%s:%d", s.host, s.port)
	fmt.Printf("🚀 服务器已启动，监听地址: http://%s:%d\n", s.host, s.port)
	fmt.Printf("📡 嗅探接口: http://%s:%d/sniffer\n", s.host, s.port)
	fmt.Printf("📄 页面源码接口: http://%s:%d/fetCodeByWebView\n", s.host, s.port)
	fmt.Printf("💚 健康检查: http://%s:%d/health\n", s.host, s.port)
	fmt.Printf("🔄 活跃状态: http://%s:%d/active\n", s.host, s.port)

	return s.engine.Run(addr)
}

// setupGracefulShutdown 设置优雅关闭
func (s *Server) setupGracefulShutdown() {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	<-c
	fmt.Println("\n收到关闭信号，正在关闭服务器...")

	if s.sniffer != nil {
		if err := s.sniffer.Close(); err != nil {
			log.Printf("关闭嗅探器时发生错误: %v", err)
		} else {
			fmt.Println("嗅探器已关闭")
		}
	}

	fmt.Println("服务器已关闭")
	os.Exit(0)
}

func main() {
	server := NewServer()
	if err := server.Start(); err != nil {
		log.Fatalf("启动服务器失败: %v", err)
	}
}