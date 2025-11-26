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
        edit: `你是一个代码重构助手，只能修改指定的代码片段，必须保持其余代码不变。

语言：{{language}}

上下文前缀（不可修改）：
\`\`\`{{language}}
{{prefix}}
\`\`\`

需要编辑的代码：
\`\`\`{{language}}
{{codeToEdit}}
\`\`\`

上下文后缀（不可修改）：
\`\`\`{{language}}
{{suffix}}
\`\`\`

用户指令：
{{userInput}}

要求：
- 只对“需要编辑的代码”做必要修改，不要改 prefix / suffix。
- 保持缩进和代码风格一致。
- 直接输出修改后的“完整代码片段”，不要任何解释、不要额外包裹 Markdown 代码块。
- 如果你无法确定安全的修改方式，请原样输出“需要编辑的代码”，不要做任何修改。`,
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
        apply: `你是一个代码修改助手，需要将“建议的新代码”正确应用到“原始代码”中。

原始代码（original_code）：
\`\`\`
{{{ original_code }}}
\`\`\`

建议的新代码（new_code）：
\`\`\`
{{{ new_code }}}
\`\`\`

要求：
- 尽量保持原始代码的结构、缩进和风格不变。
- 只在必要的位置插入或替换为 new_code，避免无关位置的修改。
- 不要删除或重排与本次修改无关的代码。
- 如果 new_code 中有完整替换的部分，只替换对应片段，不要整体重写整个文件。
- 直接输出最终的“完整文件内容”，不要任何解释性文字，不要额外包裹 Markdown 代码块。
- 如果 new_code 与 original_code 明显不兼容或会破坏现有逻辑，请优先保持 original_code 不变，而不是强行重写整个文件。`,
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
        maxPromptTokens: 1024,
        debounceDelay: 250,
        modelTimeout: 500,
        maxSuffixPercentage: 0.2,
        prefixPercentage: 0.8,
        // onlyMyCode: true,
        useCache: false,
        useImports: true,
        useRecentlyEdited: false,
        useRecentlyOpened: false,
        experimental_includeClipboard: false,
      },
      defaultCompletionOptions: {
        maxTokens: 250,
        temperature: 0.1,
        topP: 0.2,
        frequencyPenalty: 1.2,
        presencePenalty: 0.8,
      },
    },
  ],
};
