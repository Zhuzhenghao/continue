# Continue Telemetry 事件类型总结

## 📊 当前定义的事件类型

### 🔧 **核心系统事件**

#### 1. **扩展生命周期事件**

- `vscode_extension_activation_error` - VSCode扩展激活错误
- `unsupported_platform_activation_attempt` - 不支持平台激活尝试

#### 2. **错误处理事件**

- `extension_error_caught` - 扩展错误捕获
- `webview_protocol_error` - WebView协议错误
- `core_messenger_error` - 核心消息传递错误
- `stream_premature_close_error` - 流过早关闭错误

### 💬 **聊天相关事件**

#### 1. **聊天交互**

- `chat` - 聊天对话
- `useSlashCommand` - 使用斜杠命令
- `gui_stream_error` - GUI流错误
- `userInput` - 用户输入
- `step run` - 步骤运行
- `apiRequest` - API请求
- `sessionStart` - 会话开始

#### 2. **工具调用**

- `gui_tool_call_decision` - GUI工具调用决策
- `gui_tool_call_outcome` - GUI工具调用结果

#### 3. **LLM Complete请求统计（新增）**

- `complete_request_stats` - LLM Complete请求详细统计
  - `model`: 模型名称
  - `provider`: 模型提供商
  - **Token统计**:
    - `promptTokens`: 输入提示词token数
    - `generatedTokens`: 生成内容token数
    - `thinkingTokens`: 思考过程token数
    - `totalTokens`: 总token数
  - **字符长度统计**:
    - `promptLength`: 输入提示词字符长度
    - `completionLength`: 生成内容字符长度
    - `thinkingLength`: 思考过程字符长度
  - **时间统计**:
    - `totalTime`: 总处理时间 (毫秒)
    - `totalTimeSeconds`: 总处理时间 (秒)
  - `timestamp`: 时间戳

### 🤖 **自动补全事件**

#### 1. **自动补全事件（增强版）**

- `autocomplete` - 自动补全事件（包含所有相关信息）
  - `accepted`: 是否被接受
  - `cacheHit`: 是否命中缓存
  - `completionId`: 补全ID
  - `completionOptions`: 补全选项
  - `debounceDelay`: 防抖延迟
  - `fileExtension`: 文件扩展名
  - `maxPromptTokens`: 最大提示词token数
  - `modelName`: 模型名称
  - `modelProvider`: 模型提供商
  - `multilineCompletions`: 多行补全设置
  - `time`: 处理时间
  - `useRecentlyEdited`: 是否使用最近编辑的代码
  - `numLines`: 补全行数
  - `enabledStaticContextualization`: 是否启用静态上下文化
  - **新增字段**：
    - `completionLength`: 补全长度
    - `prefixLength`: 前缀长度
    - `suggestionDisplayTime`: 建议显示时间（毫秒）
    - `completion`: 完整的补全内容
    - `gitRepo`: Git仓库路径
    - `uniqueId`: 唯一标识符
    - `timestamp`: 时间戳
    - `filepath`: 文件路径

#### 2. **自动补全生命周期事件**

- `autocomplete_triggered` - 自动补全触发事件

  - `completionId`: 补全请求唯一标识
  - `filepath`: 文件路径
  - `isUntitledFile`: 是否为未命名文件
  - `position`: 光标位置 (line, character)
  - `force`: 是否强制触发
  - `timestamp`: 时间戳

- `autocomplete_llm_request_start` - LLM请求开始事件

  - `completionId`: 补全请求唯一标识
  - `filepath`: 文件路径
  - `modelProvider`: 模型提供商
  - `modelName`: 模型名称
  - `promptLength`: 提示词长度
  - `prefixLength`: 前缀长度
  - `suffixLength`: 后缀长度
  - `multiline`: 是否多行补全
  - `timestamp`: 时间戳
  - `timeSinceTriggered`: 从 autocomplete_triggered 事件到本事件的时间间隔 (毫秒)
  - `timeSinceStart`: 从 LLM 请求开始到本事件的时间间隔 (毫秒)，本事件为 0

- `autocomplete_llm_request_success` - LLM请求成功事件

  - `completionId`: 补全请求唯一标识
  - `filepath`: 文件路径
  - `modelProvider`: 模型提供商
  - `modelName`: 模型名称
  - `completionLength`: 补全内容长度
  - `processingTime`: 处理时间 (毫秒)
  - `totalTime`: 总处理时间 (毫秒)
  - `toFirstToken`: 首token时间 (毫秒)
  - `tokensPerSecond`: 每秒生成token数
  - `promptTokens`: 输入token数
  - `generatedTokens`: 生成token数
  - `timestamp`: 时间戳
  - `timeSinceTriggered`: 从 autocomplete_triggered 事件到本事件的时间间隔 (毫秒)
  - `timeSinceStart`: 从 LLM 请求开始到本事件的时间间隔 (毫秒)

- `autocomplete_llm_request_failed` - LLM请求失败事件

  - `completionId`: 补全请求唯一标识
  - `filepath`: 文件路径
  - `errorMessage`: 错误信息
  - `errorType`: 错误类型
  - `errorStatus`: 错误状态码
  - `timestamp`: 时间戳
  - `timeSinceTriggered`: 从 autocomplete_triggered 事件到本事件的时间间隔 (毫秒)
  - `timeSinceStart`: 从 LLM 请求开始到本事件的时间间隔 (毫秒)，仅在 LLM 请求已开始时记录

- `autocomplete_cancelled` - 自动补全取消事件
  - `completionId`: 补全请求唯一标识
  - `filepath`: 文件路径
  - `isUntitledFile`: 是否为未命名文件
  - `position`: 光标位置 (line, character)
  - `reason`: 取消原因
    - `"aborted_during_generation"`: 生成过程中被取消
    - `"error_during_processing"`: 处理过程中出错
    - `"empty_completion"`: 模型产出为空（或后处理为空）
  - `processingTime`: 处理时间 (毫秒)
  - `timeSinceTriggered`: 从 autocomplete_triggered 事件到本事件的时间间隔 (毫秒)
  - `timeSinceStart`: 从 LLM 请求开始到本事件的时间间隔 (毫秒)，仅在 LLM 请求已开始时记录
  - `totalTime`: 总处理时间 (毫秒)
  - `toFirstToken`: 首token时间 (毫秒)
  - `tokensPerSecond`: 每秒生成token数
  - `promptTokens`: 输入token数
  - `generatedTokens`: 生成token数
  - `errorMessage`: 错误信息（仅在 reason 为 "error_during_processing" 时存在）
  - `errorType`: 错误类型（仅在 reason 为 "error_during_processing" 时存在）
  - `errorStatus`: 错误状态码（仅在 reason 为 "error_during_processing" 时存在）
  - `modelProvider`: 模型提供商（仅在 reason 为 "empty_completion" 时存在）
  - `modelName`: 模型名称（仅在 reason 为 "empty_completion" 时存在）
  - `completionLength`: 补全长度（仅在 reason 为 "empty_completion" 时存在）
  - `cacheHit`: 是否命中缓存（仅在 reason 为 "empty_completion" 时存在）
  - `timestamp`: 时间戳

##### 前置检查与不发起请求的情况（重要）

以下情况发生在“发起 LLM 请求之前”，因此不会上报 `autocomplete_llm_request_start`，也不会真正调用模型接口：

- 缓存命中（`cacheHit: true`）：直接返回缓存补全，完全不发起请求。
- 防抖（`reason: "debounced"`）：`AutocompleteDebouncer.delayAndShouldDebounce` 判定应延后/取消本次触发。
- 预过滤阻止（`reason: "prefilter_blocked"`）：`shouldPrefilter` 命中禁用逻辑（例如 `disable`、禁用文件匹配、空 Untitled 文件、配置文件本身等）。
- 安全忽略（`reason: "security_concern"`）：`isSecurityConcern` 命中内置安全敏感清单（如 `.env`、密钥/证书、`secrets/` 目录等）。
- 无可用 LLM（`reason: "no_llm_available"`）：模型未配置/未选择，或（如 mistral）空 key。

只有在未命中上述前置条件且缓存未命中时，才会继续进行上下文收集、渲染提示词，并发起 LLM 请求（随后才可能出现 `aborted_during_generation`、`error_during_processing`、或 `empty_completion`）。

#### 2. **手动输入统计事件**

- `manual_typing_batch` - 手动输入统计批次事件
  - `events`: 手动输入事件数组（简化版，只包含时间戳、字符数、行数）
  - `totalCharactersTyped`: 总输入字符数
  - `totalLinesTyped`: 总输入行数
  - `totalKeystrokes`: 总按键次数
  - `lastTypingTime`: 最后输入时间
  - `eventCount`: 事件数量
  - `batchTimestamp`: 批次时间戳
  - **批量策略**: 每100个事件或5分钟间隔触发上报

### ✏️ **编辑相关事件**

#### 1. **内联编辑**

- `inlineEdit` - 内联编辑（在代码中定义但未找到实际使用）
  - `type`: 编辑类型
  - `prefix`: 前缀
  - `highlighted`: 高亮部分
  - `suffix`: 后缀
  - `input`: 输入
  - `language`: 语言

#### 2. **快速编辑**

- `quickEditSelection` - 快速编辑选择

#### 3. **NextEdit**

- `nextEditOutcome` - NextEdit结果

### 🔧 **配置和上下文事件**

#### 1. **配置管理**

- `config_reload` - 配置重新加载
- `VSCode Quick Actions Settings Changed` - VSCode快速操作设置更改

#### 2. **上下文提供者**

- `context_provider_get_context_items` - 上下文提供者获取上下文项
- `useContextProvider` - 使用上下文提供者

### 📚 **文档和索引事件**

#### 1. **文档管理**

- `docs_pages_crawled` - 文档页面爬取
- `add_docs_config` - 添加文档配置
- `add_docs_gui` - GUI添加文档
- `rebuild_index_clicked` - 重建索引点击

### 🎯 **用户界面事件**

#### 1. **页面浏览**

- `$pageview` - 页面浏览

#### 2. **用户交互**

- `toggle_bookmarked_slash_command` - 切换书签斜杠命令
- `gui_use_active_file_enter` - GUI使用活动文件回车
- `Onboarding Step` - 入门步骤
- `onboardingSelection` - 入门选择

### 📊 **性能和资源事件**

#### 1. **Token使用**

- `tokens_generated_batch` - Token生成批次

#### 2. **检索错误**

- `reranker_fts_retrieval` - 重排序器FTS检索错误
- `reranker_embeddings_retrieval` - 重排序器嵌入检索错误
- `reranker_recently_edited_retrieval` - 重排序器最近编辑检索错误
- `reranker_repo_map_retrieval` - 重排序器仓库映射检索错误
- `no_reranker_fts_retrieval` - 无重排序器FTS检索错误
- `no_reranker_embeddings_retrieval` - 无重排序器嵌入检索错误
- `no_reranker_recently_edited_retrieval` - 无重排序器最近编辑检索错误
- `no_reranker_repo_map_retrieval` - 无重排序器仓库映射检索错误

### 🎮 **命令事件**

#### 1. **VSCode命令**

- `acceptDiff` - 接受差异
- `rejectDiff` - 拒绝差异
- `acceptVerticalDiffBlock` - 接受垂直差异块
- `rejectVerticalDiffBlock` - 拒绝垂直差异块
- `quickFix` - 快速修复
- `defaultQuickAction` - 默认快速操作
- `customQuickActionSendToChat` - 自定义快速操作发送到聊天
- `customQuickActionStreamInlineEdit` - 自定义快速操作流式内联编辑
- `focusEdit` - 聚焦编辑
- `exitEditMode` - 退出编辑模式
- `generateRule` - 生成规则
- `writeCommentsForCode` - 为代码写注释
- `writeDocstringForCode` - 为代码写文档字符串
- `fixCode` - 修复代码
- `optimizeCode` - 优化代码
- `fixGrammar` - 修复语法
- `viewLogs` - 查看日志
- `debugTerminal` - 调试终端
- `addModel` - 添加模型
- `forceReport` - 强制报告
- `toggleTabAutocompleteEnabled` - 切换标签页自动补全启用
- `forceAutocomplete` - 强制自动补全
- `openTabAutocompleteConfigMenu` - 打开标签页自动补全配置菜单
- `enterEnterpriseLicenseKey` - 输入企业许可证密钥
- `toggleNextEditEnabled` - 切换NextEdit启用
- `forceNextEdit` - 强制NextEdit

#### 2. **CLI命令**

- `cliCommand` - CLI命令（包含具体命令：cn, login, logout, ls, serve, remote-test等）

#### 3. **IntelliJ命令**

- `jetbrains_core_exit` - JetBrains核心退出
- `jetbrains_core_start_error` - JetBrains核心启动错误

## 📋 **事件属性结构**

### 通用属性

所有事件都包含以下通用属性：

- `os`: 操作系统
- `extensionVersion`: 扩展版本
- `ideName`: IDE名称
- `ideType`: IDE类型

### 特定事件属性

#### 自动补全事件（增强版）

```typescript
interface AutocompleteEvent {
  // 原有字段
  accepted: boolean;
  cacheHit: boolean;
  completionId: string;
  completionOptions: any;
  debounceDelay: number;
  fileExtension: string;
  maxPromptTokens: number;
  modelName: string;
  modelProvider: string;
  multilineCompletions: "always" | "never" | "auto";
  time: number;
  useRecentlyEdited: boolean;
  numLines: number;
  enabledStaticContextualization?: boolean;

  // 新增字段
  completionLength: number;
  prefixLength: number;
  suggestionDisplayTime?: number;
  completion: string;
  gitRepo?: string;
  uniqueId: string;
  timestamp: string;
  filepath: string;
  profileType?: "local" | "platform" | "control-plane";

  // 其他可能存在的字段
  useFileSuffix?: boolean; // 已弃用但可能在旧数据中存在
}
```

#### 聊天事件

```typescript
interface ChatEvent {
  model: string;
  provider: string;
}
```

#### 斜杠命令事件

```typescript
interface SlashCommandEvent {
  name: string;
}
```

## 🔄 **事件上报流程**

### 1. **事件捕获**

```typescript
// 通过Telemetry.capture捕获
await Telemetry.capture("eventName", properties);
```

### 2. **数据上报**

- **Shihuo**: 内部统计平台（主要）

### 3. **批量处理**

- 每5分钟自动上报一次
- 达到10个事件时立即上报
- 失败时自动重试3次
