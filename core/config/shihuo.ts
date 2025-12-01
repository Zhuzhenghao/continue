import { ConfigYaml } from "@continuedev/config-yaml";

export const shihuoConfig: ConfigYaml = {
  name: "Shihuo Agent",
  version: "1.0.0",
  schema: "v1",
  models: [
    {
      name: "Qwen3-Coder-Chat (Shihuo)",
      provider: "openai",
      model: "qwen3-coder-480b-a35b-instruct",
      apiKey: "key-dummy",
      apiBase: "https://modelx-api.shizhi-inc.com/proxy/v1",
      roles: ["chat"],
      capabilities: ["tool_use"],
    },
    {
      name: "Qwen3-Coder-Edit (Shihuo)",
      provider: "openai",
      model: "qwen3-coder-480b-a35b-instruct",
      apiKey: "key-dummy",
      apiBase: "https://modelx-api.shizhi-inc.com/proxy/v1",
      useLegacyCompletionsEndpoint: false,
      roles: ["edit"],
      defaultCompletionOptions: {
        temperature: 0.1,
        topP: 0.9,
      },
      promptTemplates: {
        edit: `你是一个代码编辑引擎。只输出修改后的代码，不要说话。

语言：{{language}}

[上下文前缀]
{{prefix}}

[待修改代码]
{{codeToEdit}}

[上下文后缀]
{{suffix}}

[用户指令]
{{userInput}}

=== 输出规则 (严格遵守) ===
1. 直接输出修改后的代码文本。
2. **禁止**使用 Markdown 代码块。
3. **禁止**转义特殊字符（保持真实的换行和缩进）。
4. **禁止**输出 JSON 格式。

现在，请输出修改后的代码：`,
      },
    },
    {
      name: "Qwen3-Coder-Apply (Shihuo)",
      provider: "openai",
      model: "qwen3-coder-480b-a35b-instruct",
      apiKey: "key-dummy",
      apiBase: "https://modelx-api.shizhi-inc.com/proxy/v1",
      useLegacyCompletionsEndpoint: false,
      roles: ["apply"],
      defaultCompletionOptions: {
        temperature: 0.1,
        topP: 0.9,
      },
      promptTemplates: {
        apply: `你是一个文件合并工具。将 SUGGESTED_CHANGE 应用到 ORIGINAL_FILE。

<ORIGINAL_FILE>
{{ original_code }}
</ORIGINAL_FILE>

<SUGGESTED_CHANGE>
{{ new_code }}
</SUGGESTED_CHANGE>

=== 任务要求 ===
1. 根据 <SUGGESTED_CHANGE> 的内容，替换 <ORIGINAL_FILE> 中对应的部分。
2. **必须输出完整的合并后文件**，包含所有未修改的行。
3. 严禁使用 "// ...剩余代码" 或 "// ...existing code..." 进行省略。
4. 保持原始缩进和换行格式。
5. **只输出代码纯文本**，不要包裹 Markdown，不要解释。

如果无法合并，请原样输出 <ORIGINAL_FILE> 的内容。`,
      },
    },
    {
      name: "Qwen3-Coder-Autocomplete (Shihuo)",
      provider: "openai",
      model: "Qwen3-Coder-30B-A3B-Instruct-FP8",
      apiKey: "dummy",
      apiBase: "http://coder-a100.shizhi-inc.com/v1",
      roles: ["autocomplete"],
      autocompleteOptions: {
        maxPromptTokens: 2048,
        debounceDelay: 250,
        modelTimeout: 500,
        maxSuffixPercentage: 0.3,
        prefixPercentage: 0.7,
        useCache: true,
        useImports: true,
      },
      defaultCompletionOptions: {
        maxTokens: 128,
        temperature: 0.1,
        topP: 0.9,
        frequencyPenalty: 0,
        presencePenalty: 0,
      },
    },
  ],
};
