# Continue 插入代码（Insert）与 Apply 行为说明

## 1. Insert 与 Apply 的区别

### 1.1 Insert：直接在编辑器中插入/替换

前端：`gui/src/components/StyledMarkdownPreview/StepContainerPreToolbar/index.tsx`

- 代码块右上角工具条里的 `Insert` 按钮：

  - 组件：`InsertButton`
  - 调用：

    ```ts
    function onClickInsertAtCursor() {
      ideMessenger.post("insertAtCursor", { text: codeBlockContent });
    }
    ```

VS Code 扩展：`extensions/vscode/src/extension/VsCodeMessenger.ts`

- 处理 `insertAtCursor` 消息：

  ```ts
  this.onWebview("insertAtCursor", async (msg) => {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined || !editor.selection) {
      return;
    }

    editor.edit((editBuilder) => {
      editBuilder.replace(
        new vscode.Range(editor.selection.start, editor.selection.end),
        msg.data.text,
      );
    });
  });
  ```

行为总结：

- 如果当前有选区：**替换选中的代码**。
- 如果没有选区：使用一个零宽选区（光标位置），等价于“在光标处插入整块代码”。
- Insert 不知道这段代码原本是在哪个文件/位置生成的，只依赖当前编辑器 selection。

这就是“代码块 Insert 之后插在光标处导致代码错乱”的根本原因。

---

### 1.2 Apply：通过 diff / LLM 智能应用代码

前端：`StepContainerPreToolbar` 中的 `ApplyActions` 和 `onClickApply`

```ts
async function onClickApply() {
  const fileUri = await getFileUriToApplyTo();
  if (!fileUri) {
    void ideMessenger.ide.showToast(
      "error",
      "Could not resolve filepath to apply changes",
    );
    return;
  }

  // applyToFile 会在扩展侧创建/打开文件，并走 diff 流程
  ideMessenger.post("applyToFile", {
    streamId: codeBlockStreamId,
    filepath: fileUri,
    text: codeBlockContent,
  });

  setAppliedFileUri(fileUri);
  void refreshFileExists();
}
```

VS Code 扩展：`extensions/vscode/src/extension/VsCodeMessenger.ts`

```ts
this.onWebview("applyToFile", async ({ data }) => {
  const [verticalDiffManager, configHandler] = await Promise.all([
    verticalDiffManagerPromise,
    configHandlerPromise,
  ]);

  const applyManager = new ApplyManager(
    this.ide,
    webviewProtocol,
    verticalDiffManager,
    configHandler,
  );

  await applyManager.applyToFile(data);
});
```

扩展内部：`extensions/vscode/src/apply/ApplyManager.ts`

```ts
async applyToFile({ streamId, filepath, text, toolCallId, isSearchAndReplace }: ApplyToFilePayload) {
  if (filepath) {
    await this.ensureFileOpen(filepath);
  }

  const { activeTextEditor } = vscode.window;
  ...

  const originalFileContent = activeTextEditor.document.getText();

  const hasExistingDocument = !!activeTextEditor.document.getText().trim();
  if (hasExistingDocument) {
    if (isSearchAndReplace) {
      // 直接整文件重写
      await this.verticalDiffManager.instantApplyDiff(
        originalFileContent,
        text,
        streamId,
        toolCallId,
      );
    } else {
      await this.handleExistingDocument(
        activeTextEditor,
        text,
        streamId,
        toolCallId,
      );
    }
  } else {
    // 空文件，直接从 0,0 插入
    await this.handleEmptyDocument(...);
  }
}
```

`handleExistingDocument` 中会调用 `applyCodeBlock` / `handleNonInstantDiff` 来决定是否需要模型参与：

```ts
const { isInstantApply, diffLinesGenerator } = await applyCodeBlock(
  editor.document.getText(),
  text,
  getUriPathBasename(fileUri),
  llm,
  abortController,
);

if (isInstantApply) {
  await this.verticalDiffManager.streamDiffLines(
    diffLinesGenerator,
    isInstantApply,
    streamId,
    toolCallId,
  );
} else {
  await this.handleNonInstantDiff(...);
}
```

---

## 2. Apply 是否调用模型？

核心逻辑在 `core/edit/lazy/applyCodeBlock.ts`：

```ts
export async function applyCodeBlock(
  oldFile: string,
  newLazyFile: string,
  filename: string,
  llm: ILLM,
  abortController: AbortController,
): Promise<{
  isInstantApply: boolean;
  diffLinesGenerator: AsyncGenerator<DiffLine>;
}> {
  if (canUseInstantApply(filename)) {
    const diffLines = await deterministicApplyLazyEdit({
      oldFile,
      newLazyFile,
      filename,
      onlyFullFileRewrite: true,
    });

    if (diffLines !== undefined) {
      return {
        isInstantApply: true,
        diffLinesGenerator: generateLines(diffLines!),
      };
    }
  }

  // 代码块本身就是 unified diff
  if (isUnifiedDiffFormat(newLazyFile)) {
    try {
      const diffLines = applyUnifiedDiff(oldFile, newLazyFile);
      return {
        isInstantApply: true,
        diffLinesGenerator: generateLines(diffLines!),
      };
    } catch (e) {
      console.error("Failed to apply unified diff", e);
    }
  }

  // 其他情况：需要 LLM
  return {
    isInstantApply: false,
    diffLinesGenerator: streamLazyApply(
      oldFile,
      filename,
      newLazyFile,
      llm,
      abortController,
    ),
  };
}
```

三种情况：

- **确定性应用（不调用模型）**：
  - 文件扩展名在 `supportedLanguages` 中，`deterministicApplyLazyEdit` 能算出 diff。
- **代码块本身是 unified diff（不调用模型）**：
  - 通过 `applyUnifiedDiff(oldFile, newLazyFile)` 直接产出 diff。
- **其它情况（调用模型）**：
  - 走 `streamLazyApply` → `streamDiffLines`，由 LLM 决定如何把新代码应用到旧代码上。

在 VS Code 的 `handleExistingDocument` 中：

- `isInstantApply === true`：只用 diff 算法，不再请求 LLM。
- `isInstantApply === false`：会再走 `handleNonInstantDiff`，其中一定会调用 LLM。

---

## 3. diff 从哪里来？

### 3.1 不调用 LLM 的 diff

- `deterministicApplyLazyEdit`：
  - 根据 `oldFile` 与 `newLazyFile` 的结构变化，直接产生 `DiffLine[]`。
- `applyUnifiedDiff`：
  - 解析传入的 patch（unified diff），直接得到 `DiffLine[]`。

这两条路径完全是算法级 diff，不涉及模型。

### 3.2 需要 LLM 的 diff

走 `streamLazyApply` → `streamDiffLines`：`core/edit/streamDiffLines.ts`

高层逻辑：

```ts
export async function* streamDiffLines(
  options: StreamDiffLinesPayload,
  llm: ILLM,
  abortController: AbortController,
  overridePrompt: ChatMessage[] | undefined,
  rulesToInclude: RuleWithSource[] | undefined,
): AsyncGenerator<DiffLine> {
  const { type, prefix, highlighted, suffix, input, language } = options;

  // 构造 prompt（见下节）
  let prompt = overridePrompt ?? (
    type === "apply"
      ? constructApplyPrompt(oldLines.join("\n"), options.newCode, llm)
      : constructEditPrompt(prefix, highlighted, suffix, llm, input, language)
  );

  // 根据规则和 base system message 构造 systemMessage
  const systemMessage = ...;
  // 把 systemMessage 合并进 prompt
  ...

  const prediction: Prediction = {
    type: "content",
    content: highlighted,
  };

  const completion = recursiveStream(
    llm,
    abortController,
    type,
    prompt,
    prediction,
  );

  // 把模型输出按行流式读取
  let lines = streamLines(completion);
  // 各种过滤器（去英文前缀、去 markdown 代码块包裹等）
  lines = filterEnglishLinesAtStart(lines);
  lines = filterCodeBlockLines(lines);
  lines = stopAtLines(lines, () => {});
  lines = skipLines(lines);
  lines = removeTrailingWhitespace(lines);
  ...

  // 与 oldLines 做逐行 diff
  let diffLines = streamDiff(oldLines, lines);
  diffLines = filterLeadingAndTrailingNewLineInsertion(diffLines);

  // 没有高亮（插入模式）时，根据 prefix 推导缩进
  if (highlighted.length === 0) {
    const line = prefix.split("\n").slice(-1)[0];
    const indentation = line.slice(0, line.length - line.trimStart().length);
    diffLines = addIndentation(diffLines, indentation);
  }

  // 输出 DiffLine 流
  for await (const diffLine of diffLines) {
    yield diffLine;
  }
}
```

最终 `DiffLine` 流被 VS Code 的 `VerticalDiffManager` 渲染为 inline diff，可以逐块接受/拒绝。

---

## 4. Apply / Edit 的提示词结构

### 4.1 Edit 模式提示词（type = "edit"）

构造函数：

```ts
function constructEditPrompt(
  prefix: string,
  highlighted: string,
  suffix: string,
  llm: ILLM,
  userInput: string,
  language: string | undefined,
): string | ChatMessage[] {
  const template = llm.promptTemplates?.edit ?? gptEditPrompt;
  return llm.renderPromptTemplate(template, [], {
    userInput,
    prefix,
    codeToEdit: highlighted,
    suffix,
    language: language ?? "",
  });
}
```

- 模版来源：
  - 优先使用 `llm.promptTemplates.edit`；
  - 否则使用内置的 `gptEditPrompt`。
- 注入变量：
  - `userInput`：用户在 Edit 模式输入的自然语言指令；
  - `prefix`：选中区域前的代码（截短）；
  - `codeToEdit`：当前选中的代码；
  - `suffix`：选中区域后的代码（截短）；
  - `language`：语言名称。

语义：

> 给你上下文（prefix/suffix）和中间选中的代码（codeToEdit），以及用户的自然语言指令（userInput），请在此基础上生成修改后的版本。

---

### 4.2 Apply 模式提示词（type = "apply"）

构造函数：

```ts
function constructApplyPrompt(
  originalCode: string,
  newCode: string,
  llm: ILLM,
) {
  const template = llm.promptTemplates?.apply ?? defaultApplyPrompt;
  const rendered = llm.renderPromptTemplate(template, [], {
    original_code: originalCode,
    new_code: newCode,
  });

  return rendered;
}
```

在 `streamDiffLines` 中：

```ts
let prompt =
  overridePrompt ??
  (type === "apply"
    ? constructApplyPrompt(oldLines.join("\n"), options.newCode, llm)
    : constructEditPrompt(...));
```

- 模版来源：
  - 优先使用 `llm.promptTemplates.apply`；
  - 否则使用内置的 `defaultApplyPrompt`（`core/llm/templates/edit/gpt.ts`）。
- 注入变量：
  - `original_code`：被视为“旧代码”的部分（通常是 `oldLines.join("\n")`，来源于高亮区域或推导的行）；
  - `new_code`：从 chat 代码块拿到的“建议新代码”（`options.newCode`）。

语义：

> 给你原始代码和建议的新代码，请生成一个合适的修改版本 / diff，使新代码被合理地应用到原代码上，尽量保持未修改部分不变。

---

### 4.3 System message 与规则

`streamDiffLines` 中根据是否有规则 / base system message 决定是否插入 system 消息：

```ts
const systemMessage =
  rulesToInclude || llm.baseChatSystemMessage
    ? getSystemMessageWithRules({
        availableRules: rulesToInclude ?? [],
        userMessage: ..., // 从 prompt 中找到最后的 user/tool 消息
        baseSystemMessage: llm.baseChatSystemMessage,
        contextItems: [],
      }).systemMessage
    : undefined;

if (systemMessage) {
  if (typeof prompt === "string") {
    prompt = [
      { role: "system", content: systemMessage },
      { role: "user", content: prompt },
    ];
  } else {
    const curSysMsg = prompt.find((msg) => msg.role === "system");
    if (curSysMsg) {
      curSysMsg.content = systemMessage + "\n\n" + curSysMsg.content;
    } else {
      prompt.unshift({ role: "system", content: systemMessage });
    }
  }
}
```

- 如果配置了规则（`rulesToInclude`）或 `llm.baseChatSystemMessage`：
  - 使用 `getSystemMessageWithRules` 构造带规则的 system 提示词；
  - 把它注入到 prompt（字符串或 ChatMessage[]）的最前面；
  - 这样 Apply/Edit 流就能共享统一的规则体系。

---

## 5. 推荐使用方式 & 常见问题

- **避免 Insert 导致代码错乱**：

  - 如果只是“贴一段新代码到某处”，建议先选中要替换的代码，再点 `Insert`；
  - 如果是“在已有代码基础上修改”，更推荐用 `Apply`，利用 diff/LLM 智能应用，配合可视化 accept/reject。

- **自定义 Apply 行为**：

  - 可以通过 `llm.promptTemplates.apply` 自定义 Apply 的提示词模版，强化例如：
    - 尽量保持未改动代码不变；
    - 不要随便重排 import/函数顺序；
    - 优先做局部替换而非全文件重写。

- **调试 Apply 问题时的关键文件**：
  - 前端：
    - `gui/src/components/StyledMarkdownPreview/StepContainerPreToolbar/index.tsx`
  - VS Code 扩展：
    - `extensions/vscode/src/extension/VsCodeMessenger.ts`（`applyToFile`、`insertAtCursor`）
    - `extensions/vscode/src/apply/ApplyManager.ts`
    - `extensions/vscode/src/diff/vertical/manager.ts`
  - Core：
    - `core/edit/lazy/applyCodeBlock.ts`
    - `core/edit/streamDiffLines.ts`
    - `core/llm/templates/edit/*`（`gptEditPrompt`、`defaultApplyPrompt`）

---

## 6. Edit 模型选择与 Qwen3 Coder 适配建议

### 6.1 适合做 Edit 的模型特性

Edit 流程在代码上依赖 `streamDiffLines` + `verticalDiffManager.streamEdit`，对模型有几方面要求：

- **代码编辑稳定性**：

  - 能在给定 `prefix / codeToEdit / suffix` 的前提下，只改必要的部分，不随便重排整个文件。
  - 遵守「保持未修改代码不变」「尽量最小 diff」这类约束。

- **强指令遵从（instruction following）**：

  - 对「只加日志」「只抽函数，不改逻辑」等指令理解到位。

- **代码能力和多语言支持**：

  - 能正确处理项目主语言（TS/JS、Python、Java 等）。

- **上下文长度足够**：

  - Edit 会携带 prefix/suffix + 选中代码，推荐 8k+，最好 16k token 以上。

- **输出格式干净**：
  - 避免在结果中混入解释性文字，减少 Markdown 代码块包裹（我们有过滤，但模型本身配合更好）。

### 6.2 Qwen3 Coder 作为 Edit 模型的适配思路

从实现上看，Edit 流对具体模型是「通过 `ILLM` 接口 + 提示词模版」来抽象的，不需要在核心代码里为某个模型写 if 分支；只要 Qwen3 Coder 按 Chat 接口暴露出来即可。

#### 6.2.1 在 Continue 配置中单独设为 `edit` 角色

建议给 Qwen3 Coder 单独挂在 `edit` 角色上，`chat` 可以使用另一个通用对话模型。例如（伪配置）：

```yaml
models:
  - id: qwen3-coder-edit
    # provider / apiKey / baseUrl 等按实际接入方式配置
    # 例如走 OpenAI-compatible:
    # provider: openai-compatible
    # model: qwen/qwen3-coder
    roles: [edit]
```

然后 `selectedModelByRole.edit` 指向 `qwen3-coder-edit`，`chat` 角色可以配置为另一个模型。

#### 6.2.2 自定义一版适合 Qwen3 的 Edit 提示词

默认的 `gptEditPrompt` 是为 GPT 系列设计的，对 Qwen3 Coder 一般也能工作，但为了 edit 更稳定，可以通过 `llm.promptTemplates.edit` 覆盖一版更「严谨」的模版，例如：

````yaml
models:
  - id: qwen3-coder-edit
    ...
    promptTemplates:
      edit: |
        你是一个代码重构助手，只能修改指定的代码片段，必须保持其余代码不变。

        - 上下文前缀（不可修改）：
        ```{{language}}
        {{prefix}}
        ```
        - 需要编辑的代码：
        ```{{language}}
        {{codeToEdit}}
        ```
        - 上下文后缀（不可修改）：
        ```{{language}}
        {{suffix}}
        ```

        用户指令：
        {{userInput}}

        要求：
        - 只对“需要编辑的代码”做必要修改，不要改 prefix / suffix。
        - 保持缩进和代码风格一致。
        - 直接输出修改后的“完整代码片段”，不要任何解释、不要额外包裹 Markdown 代码块。
````

注意要点：

- 明确写「不要输出解释」「不要再包 ```」，可减少 Qwen 系列爱讲解的倾向。
- 强调「只改中间块，前后不能动」，有助于生成更干净的 diff。
- 使用 `{{language}}` 提示具体语言，有助于模型选择合适风格。

#### 6.2.3 用真实用例验证 Qwen3 Coder 的 Edit 行为

在真实文件中测试几类典型 Edit：

- 小范围重命名 / 抽函数；
- 插入日志 / 增加参数；
- 不改逻辑、只修 bug 的修改。

重点观察：

- 是否会整体重写函数或文件；
- 是否乱改注释 / import 顺序 / 无关代码块；
- 是否在输出中混入中文/英文解释。

如出现上述问题，可以：

- 进一步强化 Edit 提示词中的约束；
- 或考虑把 Qwen3 Coder 主要用于 `chat` 角色，将 `edit` 交给一个更守规矩的代码模型。
