package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/devices"
	"github.com/go-rod/rod/lib/launcher"
	"github.com/go-rod/rod/lib/proto"
)

// SnifferConfig 嗅探器配置
type SnifferConfig struct {
	Debug           bool   `json:"debug"`
	Headless        bool   `json:"headless"`
	UseChrome       bool   `json:"use_chrome"`
	DeviceType      string `json:"device_type"`
	UserAgent       string `json:"user_agent"`
	Timeout         int    `json:"timeout"`
	SnifferTimeout  int    `json:"sniffer_timeout"`
	HeadTimeout     int    `json:"head_timeout"`
	ConcurrencyNum  int    `json:"concurrency_num"`
	CustomRegex     string `json:"custom_regex"`
}

// Sniffer 嗅探器结构体
type Sniffer struct {
	config         *SnifferConfig
	browser        *rod.Browser
	urlRegex       *regexp.Regexp
	urlNoHead      *regexp.Regexp
	excludeRegex   *regexp.Regexp
	blockResources []string
}

// SnifferOptions 嗅探选项
type SnifferOptions struct {
	Mode           int               `json:"mode"`
	CustomRegex    string            `json:"custom_regex"`
	SnifferExclude string            `json:"sniffer_exclude"`
	Timeout        int               `json:"timeout"`
	CSS            string            `json:"css"`
	IsPc           bool              `json:"is_pc"`
	Headers        map[string]string `json:"headers"`
	Script         string            `json:"script"`
	InitScript     string            `json:"init_script"`
}

// SnifferResult 嗅探结果
type SnifferResult struct {
	URL        string            `json:"url,omitempty"`
	URLs       []URLWithHeaders  `json:"urls,omitempty"`
	Headers    map[string]string `json:"headers,omitempty"`
	From       string            `json:"from"`
	Cost       string            `json:"cost"`
	Code       int               `json:"code"`
	Script     string            `json:"script,omitempty"`
	InitScript string            `json:"init_script,omitempty"`
	Msg        string            `json:"msg"`
}

// URLWithHeaders URL和请求头
type URLWithHeaders struct {
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
}

// PageCodeResult 页面源码结果
type PageCodeResult struct {
	Code       string `json:"code"`
	From       string `json:"from"`
	Cost       string `json:"cost"`
	Script     string `json:"script,omitempty"`
	InitScript string `json:"init_script,omitempty"`
	Msg        string `json:"msg"`
}

// NewSniffer 创建新的嗅探器实例
func NewSniffer(config *SnifferConfig) *Sniffer {
	if config == nil {
		config = &SnifferConfig{
			Debug:          true,
			Headless:       true,
			UseChrome:      true,
			DeviceType:     "mobile",
			Timeout:        30000,
			SnifferTimeout: 10000,
			HeadTimeout:    5000,
			ConcurrencyNum: 3,
		}
	}

	// 默认正则表达式 - 兼容 Go RE2 引擎（不支持负向前瞻）
	// 匹配包含媒体文件扩展名的 URL
	urlRegex := regexp.MustCompile(`(?i)https?://[^\s"'<>]{12,}?\.(m3u8|mp4|flv|avi|mkv|rm|wmv|mpg|m4a|mp3)(\?[^\s"'<>]*)?|https?://[^\s"'<>]*?(video|obj)/tos[^\s"'<>]*`)
	urlNoHead := regexp.MustCompile(`https?://[^\s"'<>]{12,}?(ac=dm&url=)`)

	// 阻止的资源类型
	blockResources := []string{
		"image", "stylesheet", "font", "texttrack", "object", "beacon",
		"csp_report", "imageset", "media",
	}

	return &Sniffer{
		config:         config,
		urlRegex:       urlRegex,
		urlNoHead:      urlNoHead,
		blockResources: blockResources,
	}
}

// log 日志输出
func (s *Sniffer) log(args ...interface{}) {
	if s.config.Debug {
		log.Println(args...)
	}
}

// InitBrowser 初始化浏览器
func (s *Sniffer) InitBrowser() error {
	var l *launcher.Launcher

	if s.config.UseChrome {
		// 查找系统中的 Chrome
		l = launcher.New().Headless(s.config.Headless)
	} else {
		// 使用内置浏览器
		l = launcher.New().Headless(s.config.Headless)
	}

	// 设置启动参数
	l = l.Set("disable-blink-features", "AutomationControlled").
		Set("disable-features", "VizDisplayCompositor,TranslateUI").
		Set("disable-ipc-flooding-protection").
		Set("disable-renderer-backgrounding").
		Set("disable-backgrounding-occluded-windows").
		Set("disable-background-timer-throttling").
		Set("disable-background-networking").
		Set("disable-breakpad").
		Set("disable-client-side-phishing-detection").
		Set("disable-component-extensions-with-background-pages").
		Set("disable-default-apps").
		Set("disable-dev-shm-usage").
		Set("disable-extensions").
		Set("disable-features", "TranslateUI").
		Set("disable-hang-monitor").
		Set("disable-popup-blocking").
		Set("disable-prompt-on-repost").
		Set("disable-sync").
		Set("disable-web-security").
		Set("metrics-recording-only").
		Set("no-first-run").
		Set("no-default-browser-check").
		Set("password-store", "basic").
		Set("use-mock-keychain").
		Set("no-sandbox").
		Set("disable-setuid-sandbox")

	url, err := l.Launch()
	if err != nil {
		return fmt.Errorf("启动浏览器失败: %v", err)
	}

	browser := rod.New().ControlURL(url)
	err = browser.Connect()
	if err != nil {
		return fmt.Errorf("连接浏览器失败: %v", err)
	}

	s.browser = browser
	s.log("浏览器初始化成功")
	return nil
}

// GetPage 获取新页面
func (s *Sniffer) GetPage(headers map[string]string) (*rod.Page, error) {
	if s.browser == nil {
		return nil, fmt.Errorf("浏览器未初始化")
	}

	page, err := s.browser.Page(proto.TargetCreateTarget{})
	if err != nil {
		return nil, fmt.Errorf("创建页面失败: %v", err)
	}

	// 设置设备模拟
	if !strings.Contains(s.config.DeviceType, "pc") {
		device := devices.IPhoneX
		err = page.Emulate(device)
		if err != nil {
			s.log("设备模拟失败:", err)
		}
	}

	// 设置用户代理
	userAgent := s.config.UserAgent
	if userAgent == "" {
		if strings.Contains(s.config.DeviceType, "pc") {
			userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
		} else {
			userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
		}
	}

	err = page.SetUserAgent(&proto.NetworkSetUserAgentOverride{
		UserAgent: userAgent,
	})
	if err != nil {
		s.log("设置用户代理失败:", err)
	}

	// 设置额外的请求头
	if len(headers) > 0 {
		headerList := make([]string, 0, len(headers)*2)
		for k, v := range headers {
			headerList = append(headerList, k, v)
		}
		_, err = page.SetExtraHeaders(headerList)
		if err != nil {
			s.log("设置额外请求头失败:", err)
		}
	}

	// 设置 User-Agent
	if userAgent != "" {
		err = page.SetUserAgent(&proto.NetworkSetUserAgentOverride{
			UserAgent: userAgent,
		})
		if err != nil {
			s.log("设置 User-Agent 失败:", err)
		}
	}

	// 注释掉资源阻止逻辑，避免与主要的嗅探拦截器冲突
	// 资源阻止将在主要的嗅探拦截器中处理

	return page, nil
}

// shouldBlockResource 检查是否应该阻止资源
func (s *Sniffer) shouldBlockResource(resourceType string) bool {
	for _, blockType := range s.blockResources {
		if resourceType == blockType {
			return true
		}
	}
	return false
}

// ClosePage 关闭页面
func (s *Sniffer) ClosePage(page *rod.Page) {
	if page != nil {
		err := page.Close()
		if err != nil {
			s.log("关闭页面失败:", err)
		}
	}
}

// Close 关闭浏览器
func (s *Sniffer) Close() error {
	if s.browser != nil {
		err := s.browser.Close()
		if err != nil {
			return fmt.Errorf("关闭浏览器失败: %v", err)
		}
		s.log("浏览器已关闭")
	}
	return nil
}

// IsValidURL 检查 URL 是否有效
func (s *Sniffer) IsValidURL(urlStr string) bool {
	_, err := url.Parse(urlStr)
	return err == nil && (strings.HasPrefix(urlStr, "http://") || strings.HasPrefix(urlStr, "https://"))
}

// IsRealURLCheck 检查是否为真实媒体 URL
func (s *Sniffer) IsRealURLCheck(urlStr string) bool {
	// 排除一些明显不是媒体文件的 URL
	excludePatterns := []string{
		"google", "facebook", "twitter", "analytics", "doubleclick",
		".css", ".js", ".html", ".htm", ".png", ".jpg", ".jpeg", ".gif",
	}

	lowerURL := strings.ToLower(urlStr)
	for _, pattern := range excludePatterns {
		if strings.Contains(lowerURL, pattern) {
			return false
		}
	}

	return true
}

// CanHeadCheck 检查是否可以进行 HEAD 请求
func (s *Sniffer) CanHeadCheck(urlStr string) bool {
	// 简单的检查逻辑
	return !s.urlNoHead.MatchString(urlStr)
}

// SnifferMediaURL 嗅探媒体 URL
func (s *Sniffer) SnifferMediaURL(playURL string, options *SnifferOptions) (*SnifferResult, error) {
	startTime := time.Now()

	if options == nil {
		options = &SnifferOptions{
			Mode:    0,
			Timeout: s.config.SnifferTimeout,
		}
	}

	// 验证 URL
	if !s.IsValidURL(playURL) {
		return &SnifferResult{
			Code: 400,
			Msg:  "无效的 URL",
			From: playURL,
			Cost: fmt.Sprintf("%d ms", time.Since(startTime).Milliseconds()),
		}, nil
	}

	realURLs := make([]URLWithHeaders, 0)
	headURLs := make(map[string]bool)

	page, err := s.GetPage(options.Headers)
	if err != nil {
		return &SnifferResult{
			Code: 500,
			Msg:  fmt.Sprintf("创建页面失败: %v", err),
			From: playURL,
			Cost: fmt.Sprintf("%d ms", time.Since(startTime).Milliseconds()),
		}, nil
	}
	defer s.ClosePage(page)

	// 设置超时
	timeout := time.Duration(options.Timeout) * time.Millisecond
	if options.Mode == 1 {
		if options.Timeout > s.config.Timeout {
			timeout = time.Duration(s.config.Timeout) * time.Millisecond
		}
	} else {
		if options.Timeout > s.config.SnifferTimeout {
			timeout = time.Duration(s.config.SnifferTimeout) * time.Millisecond
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// 请求拦截器
	router := page.HijackRequests()
	router.MustAdd("*", func(hijack *rod.Hijack) {
		reqURL := hijack.Request.URL().String()
		method := hijack.Request.Method()
		headers := hijack.Request.Headers()
		resourceType := hijack.Request.Type()

		s.log("on_request:", reqURL, "method:", method, "type:", resourceType)
		
		// 检查是否需要阻止的资源类型
		if s.shouldBlockResource(string(resourceType)) {
			s.log("blocking resource type:", resourceType, "for URL:", reqURL)
			hijack.Response.Fail(proto.NetworkErrorReasonBlockedByClient)
			return
		}
		
		// 添加调试：检查是否匹配默认正则
		if s.urlRegex.MatchString(reqURL) {
			s.log("URL matches urlRegex:", reqURL)
			if s.IsRealURLCheck(reqURL) {
				s.log("URL passes IsRealURLCheck:", reqURL)
			} else {
				s.log("URL fails IsRealURLCheck:", reqURL)
			}
		}

		// 检查排除正则
		if options.SnifferExclude != "" {
			excludeRegex, err := regexp.Compile("(?mi)" + options.SnifferExclude)
			if err == nil && excludeRegex.MatchString(reqURL) {
				hijack.ContinueRequest(&proto.FetchContinueRequest{})
				return
			}
		}

		// 检查自定义正则
		if options.CustomRegex != "" {
			customRegex, err := regexp.Compile("(?mi)" + options.CustomRegex)
			if err == nil && customRegex.MatchString(reqURL) {
				reqHeaders := make(map[string]string)
				if referer, ok := headers["referer"]; ok && referer.String() != "" {
					reqHeaders["referer"] = referer.String()
				}
				if userAgent, ok := headers["user-agent"]; ok && userAgent.String() != "" {
					reqHeaders["user-agent"] = userAgent.String()
				}

				realURLs = append(realURLs, URLWithHeaders{
					URL:     reqURL,
					Headers: reqHeaders,
				})

				s.log("通过custom_regex嗅探到真实地址:", reqURL)

				if options.Mode == 0 {
					cancel() // 触发超时，结束嗅探
				}
				hijack.ContinueRequest(&proto.FetchContinueRequest{})
				return
			}
		}

		// 检查默认正则
		if s.urlRegex.MatchString(reqURL) && s.IsRealURLCheck(reqURL) {
			if !strings.Contains(reqURL, "url=http") && !strings.Contains(reqURL, "v=http") &&
				!strings.Contains(reqURL, ".css") && !strings.Contains(reqURL, ".html") {

				reqHeaders := make(map[string]string)
				if referer, ok := headers["referer"]; ok && referer.String() != "" {
					reqHeaders["referer"] = referer.String()
				}
				if userAgent, ok := headers["user-agent"]; ok && userAgent.String() != "" {
					reqHeaders["user-agent"] = userAgent.String()
				}

				realURLs = append(realURLs, URLWithHeaders{
					URL:     reqURL,
					Headers: reqHeaders,
				})

				s.log("通过默认正则嗅探到真实地址:", reqURL)

				if options.Mode == 0 {
					cancel() // 触发超时，结束嗅探
				}
			}
		} else if strings.ToLower(method) == "get" && strings.HasPrefix(reqURL, "http") && reqURL != playURL {
			// HEAD 请求检查逻辑
			parsedURL, err := url.Parse(reqURL)
			if err == nil {
				path := parsedURL.Path
				filename := ""
				if idx := strings.LastIndex(path, "/"); idx >= 0 {
					filename = path[idx+1:]
				}

				shouldCheck := (filename != "" && !strings.Contains(filename, ".") && !s.urlNoHead.MatchString(reqURL)) ||
					(strings.Contains(filename, ".") && len(filename) > 1)

				if shouldCheck && !headURLs[reqURL] && s.CanHeadCheck(reqURL) {
					go func(checkURL string) {
						client := &http.Client{
							Timeout: time.Duration(s.config.HeadTimeout) * time.Millisecond,
						}

						req, err := http.NewRequest("HEAD", checkURL, nil)
						if err != nil {
							s.log("创建HEAD请求失败:", err)
							return
						}

						resp, err := client.Do(req)
						if err != nil {
							s.log("HEAD请求失败:", err)
							return
						}
						defer resp.Body.Close()

						contentType := resp.Header.Get("content-type")
						contentDisposition := resp.Header.Get("content-disposition")

						if contentType == "application/octet-stream" &&
							contentDisposition != "" && strings.Contains(contentDisposition, ".m3u8") {

							reqHeaders := make(map[string]string)
			if referer, ok := headers["referer"]; ok && referer.String() != "" {
				reqHeaders["referer"] = referer.String()
			}
			if userAgent, ok := headers["user-agent"]; ok && userAgent.String() != "" {
				reqHeaders["user-agent"] = userAgent.String()
			}

							realURLs = append(realURLs, URLWithHeaders{
								URL:     checkURL,
								Headers: reqHeaders,
							})

							s.log("通过head请求嗅探到真实地址:", checkURL)

							if options.Mode == 0 {
								cancel() // 触发超时，结束嗅探
							}
						}
					}(reqURL)

					headURLs[reqURL] = true
				}
			}
		}

		hijack.ContinueRequest(&proto.FetchContinueRequest{})
	})
	go router.Run()

	// 执行初始化脚本
	if options.InitScript != "" {
		s.log("开始执行页面初始化js:", options.InitScript)
		_, err = page.EvalOnNewDocument(options.InitScript)
		if err != nil {
			s.log("执行页面初始化js发生错误:", err)
		}
	}

	// 导航到页面
	err = rod.Try(func() {
		page.Context(ctx).MustNavigate(playURL)
		// 尝试等待页面加载，但不强制要求成功
		rod.Try(func() {
			page.Context(ctx).MustWaitLoad()
		})
	})
	if err != nil {
		s.log("页面导航失败:", err)
		// 继续执行，不要因为导航失败就停止
	}

	// 等待 CSS 选择器
	if options.CSS != "" {
		err = rod.Try(func() {
			page.Context(ctx).MustElement(options.CSS)
		})
		if err != nil {
			s.log("等待CSS选择器失败:", err)
		}
	}

	// 执行页面脚本
	if options.Script != "" {
		s.log("开始执行网页js:", options.Script)
		jsCode := fmt.Sprintf(`
			var scriptTimer;
			var scriptCounter = 0;
			scriptTimer = setInterval(function(){
				if(location.href !== 'about:blank'){
					scriptCounter += 1;
					console.log('---第' + scriptCounter + '次执行script[' + location.href + ']---');
					%s
					clearInterval(scriptTimer);
					scriptCounter = 0;
					console.log('---执行script成功---');
				}
			}, 200);
		`, options.Script)

		err = rod.Try(func() {
			page.Context(ctx).MustEval(jsCode)
		})
		if err != nil {
			s.log("执行页面脚本失败:", err)
		}
	}

	// 等待结果
	if options.Mode == 0 {
		// 等待找到第一个 URL 或超时
		<-ctx.Done()
	} else if options.Mode == 1 {
		// 等待指定时间收集所有 URL
		<-ctx.Done()
	}

	cost := time.Since(startTime)
	costStr := fmt.Sprintf("%d ms", cost.Milliseconds())

	s.log("共计耗时", cost.Milliseconds(), "毫秒")
	s.log("realURLs:", realURLs)

	// 返回结果
	if options.Mode == 0 && len(realURLs) > 0 {
		return &SnifferResult{
			URL:        realURLs[0].URL,
			Headers:    realURLs[0].Headers,
			From:       playURL,
			Cost:       costStr,
			Code:       200,
			Script:     options.Script,
			InitScript: options.InitScript,
			Msg:        "超级嗅探解析成功",
		}, nil
	} else if options.Mode == 1 && len(realURLs) > 0 {
		return &SnifferResult{
			URLs:       realURLs,
			Code:       200,
			From:       playURL,
			Cost:       costStr,
			Script:     options.Script,
			InitScript: options.InitScript,
			Msg:        "超级嗅探解析成功",
		}, nil
	} else {
		return &SnifferResult{
			URL:        "",
			Headers:    make(map[string]string),
			From:       playURL,
			Cost:       costStr,
			Script:     options.Script,
			InitScript: options.InitScript,
			Code:       404,
			Msg:        "超级嗅探解析失败",
		}, nil
	}
}

// FetCodeByWebView 获取页面源码
func (s *Sniffer) FetCodeByWebView(pageURL string, options *SnifferOptions) (*PageCodeResult, error) {
	startTime := time.Now()

	if options == nil {
		options = &SnifferOptions{
			Timeout: s.config.Timeout,
		}
	}

	// 验证 URL
	if !s.IsValidURL(pageURL) {
		return &PageCodeResult{
			Code: "",
			From: pageURL,
			Cost: fmt.Sprintf("%d ms", time.Since(startTime).Milliseconds()),
			Msg:  "无效的 URL",
		}, nil
	}

	page, err := s.GetPage(options.Headers)
	if err != nil {
		return &PageCodeResult{
			Code: "",
			From: pageURL,
			Cost: fmt.Sprintf("%d ms", time.Since(startTime).Milliseconds()),
			Msg:  fmt.Sprintf("创建页面失败: %v", err),
		}, nil
	}
	defer s.ClosePage(page)

	// 设置超时
	timeout := time.Duration(options.Timeout) * time.Millisecond
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// 执行初始化脚本
	if options.InitScript != "" {
		s.log("开始执行页面初始化js:", options.InitScript)
		_, err = page.EvalOnNewDocument(options.InitScript)
		if err != nil {
			s.log("执行页面初始化js发生错误:", err)
		}
	}

	// 导航到页面
	err = rod.Try(func() {
		page.Context(ctx).MustNavigate(pageURL).MustWaitLoad()
	})
	if err != nil {
		s.log("页面导航失败:", err)
		return &PageCodeResult{
			Code: "",
			From: pageURL,
			Cost: fmt.Sprintf("%d ms", time.Since(startTime).Milliseconds()),
			Msg:  fmt.Sprintf("页面导航失败: %v", err),
		}, nil
	}

	// 等待 CSS 选择器
	if options.CSS != "" {
		err = rod.Try(func() {
			page.Context(ctx).MustElement(options.CSS)
		})
		if err != nil {
			s.log("等待CSS选择器失败:", err)
		}
	}

	// 执行页面脚本
	if options.Script != "" {
		s.log("开始执行网页js:", options.Script)
		err = rod.Try(func() {
			page.Context(ctx).MustEval(options.Script)
		})
		if err != nil {
			s.log("执行页面脚本失败:", err)
		}
	}

	// 获取页面源码
	var htmlContent string
	err = rod.Try(func() {
		htmlContent = page.Context(ctx).MustHTML()
	})
	if err != nil {
		s.log("获取页面源码失败:", err)
		return &PageCodeResult{
			Code: "",
			From: pageURL,
			Cost: fmt.Sprintf("%d ms", time.Since(startTime).Milliseconds()),
			Msg:  fmt.Sprintf("获取页面源码失败: %v", err),
		}, nil
	}

	cost := time.Since(startTime)
	costStr := fmt.Sprintf("%d ms", cost.Milliseconds())

	s.log("获取页面源码成功，耗时", cost.Milliseconds(), "毫秒")

	return &PageCodeResult{
		Code:       htmlContent,
		From:       pageURL,
		Cost:       costStr,
		Script:     options.Script,
		InitScript: options.InitScript,
		Msg:        "获取页面源码成功",
	}, nil
}