import { ConfigYaml } from "@continuedev/config-yaml";

export const shihuoConfig: ConfigYaml = {
  name: "Shihuo Agent",
  version: "1.0.0",
  schema: "v1",
  models: [
    {
      name: "Qwen3-Coder-Plus (Shihuo Default)",
      provider: "openai",
      model: "qwen3-coder-plus",
      apiKey: "key-dummy",
      apiBase: "https://modelx-api.shizhi-inc.com/proxy/v1",
      roles: ["chat", "edit"],
      capabilities: ["tool_use"],
    },
    {
      name: "Qwen3-Coder-480B-A35B",
      provider: "openai",
      model: "qwen3-coder-480b-a35b-instruct",
      apiKey: "key-dummy",
      apiBase: "https://modelx-api.shizhi-inc.com/proxy/v1",
      roles: ["chat", "edit"],
      capabilities: ["tool_use"],
    },
    {
      name: "Qwen3-Coder-30B (Shihuo Default)",
      provider: "openai",
      model: "Qwen3-Coder-30B-A3B-Instruct-FP8",
      apiKey: "dummy",
      apiBase: "http://coder-a100.shizhi-inc.com/v1",
      roles: ["autocomplete"],
      autocompleteOptions: {
        maxPromptTokens: 1024,
        debounceDelay: 250,
        modelTimeout: 800,
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
    {
      name: "Morph Fast Apply (Shihuo Default)",
      provider: "openai",
      model: "morph-v2",
      apiKey: "sk-ZSvmi1wherq3x_hkAH5ZnHoPCLPJkI-oHM7O6lJjljU_DqBd",
      apiBase: "https://api.morphllm.com/v1/",
      roles: ["apply"],
      promptTemplates: {
        apply:
          "<code>{{{ original_code }}}</code>\n<update>{{{ new_code }}}</update>",
      },
    },
    {
      name: "Relace Fast Apply",
      provider: "relace",
      model: "Fast-Apply",
      apiKey: "rlc-XPTJvcAQFouZnNBVQ_yW6ax1Rt1CASJn8BTG-A",
      roles: ["apply"],
      promptTemplates: {
        apply: "{{{ new_code }}}",
      },
    },
  ],
};
