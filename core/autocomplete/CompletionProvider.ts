import { ConfigHandler } from "../config/ConfigHandler.js";
import { IDE, ILLM } from "../index.js";
import OpenAI from "../llm/llms/OpenAI.js";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../util/parameters.js";
import { Telemetry } from "../util/posthog.js";

import { shouldCompleteMultiline } from "./classification/shouldCompleteMultiline.js";
import { ContextRetrievalService } from "./context/ContextRetrievalService.js";

import { isSecurityConcern } from "../indexing/ignore.js";
import { BracketMatchingService } from "./filtering/BracketMatchingService.js";
import { CompletionStreamer } from "./generation/CompletionStreamer.js";
import { postprocessCompletion } from "./postprocessing/index.js";
import { shouldPrefilter } from "./prefiltering/index.js";
import { getAllSnippetsWithoutRace } from "./snippets/index.js";
import { renderPromptWithTokenLimit } from "./templating/index.js";
import { GetLspDefinitionsFunction } from "./types.js";
import { AutocompleteDebouncer } from "./util/AutocompleteDebouncer.js";
import { AutocompleteLoggingService } from "./util/AutocompleteLoggingService.js";
import AutocompleteLruCache from "./util/AutocompleteLruCache.js";
import { HelperVars } from "./util/HelperVars.js";
import { AutocompleteInput, AutocompleteOutcome } from "./util/types.js";

const autocompleteCachePromise = AutocompleteLruCache.get();

// Errors that can be expected on occasion even during normal functioning should not be shown.
// Not worth disrupting the user to tell them that a single autocomplete request didn't go through
const ERRORS_TO_IGNORE = [
  // From Ollama
  "unexpected server status",
  "operation was aborted",
];

export class CompletionProvider {
  private autocompleteCache?: AutocompleteLruCache;
  public errorsShown: Set<string> = new Set();
  private bracketMatchingService = new BracketMatchingService();
  private debouncer = new AutocompleteDebouncer();
  private completionStreamer: CompletionStreamer;
  private loggingService = new AutocompleteLoggingService();
  private contextRetrievalService: ContextRetrievalService;

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly _injectedGetLlm: () => Promise<ILLM | undefined>,
    private readonly _onError: (e: any) => void,
    private readonly getDefinitionsFromLsp: GetLspDefinitionsFunction,
  ) {
    this.completionStreamer = new CompletionStreamer(this.onError.bind(this));
    this.contextRetrievalService = new ContextRetrievalService(this.ide);
    void this.initCache();
  }

  private async initCache() {
    try {
      this.autocompleteCache = await autocompleteCachePromise;
    } catch (e) {
      console.error("Failed to initialize autocomplete cache:", e);
    }
  }

  private async getCache(): Promise<AutocompleteLruCache> {
    if (!this.autocompleteCache) {
      this.autocompleteCache = await autocompleteCachePromise;
    }
    return this.autocompleteCache;
  }

  private async _prepareLlm(): Promise<ILLM | undefined> {
    const llm = await this._injectedGetLlm();

    if (!llm) {
      return undefined;
    }

    // Temporary fix for JetBrains autocomplete bug as described in https://github.com/continuedev/continue/pull/3022
    if (llm.model === undefined && llm.completionOptions?.model !== undefined) {
      llm.model = llm.completionOptions.model;
    }

    // Ignore empty API keys for Mistral since we currently write
    // a template provider without one during onboarding
    if (llm.providerName === "mistral" && llm.apiKey === "") {
      return undefined;
    }

    // Set temperature (but don't override)
    if (llm.completionOptions.temperature === undefined) {
      llm.completionOptions.temperature = 0.01;
    }

    if (llm instanceof OpenAI) {
      llm.useLegacyCompletionsEndpoint = true;
    }

    return llm;
  }

  private onError(e: any) {
    if (
      ERRORS_TO_IGNORE.some((err) =>
        typeof e === "string" ? e.includes(err) : e?.message?.includes(err),
      )
    ) {
      return;
    }

    console.warn("Error generating autocompletion: ", e);
    if (!this.errorsShown.has(e.message)) {
      this.errorsShown.add(e.message);
      this._onError(e);
    }
  }

  public cancel() {
    this.loggingService.cancel();
  }

  public accept(completionId: string) {
    const outcome = this.loggingService.accept(completionId);
    if (!outcome) {
      return;
    }
    this.bracketMatchingService.handleAcceptedCompletion(
      outcome.completion,
      outcome.filepath,
    );
  }

  public markDisplayed(completionId: string, outcome: AutocompleteOutcome) {
    this.loggingService.markDisplayed(completionId, outcome);
  }

  private async _getAutocompleteOptions(llm: ILLM) {
    const { config } = await this.configHandler.loadConfig();
    const options = {
      ...DEFAULT_AUTOCOMPLETE_OPTS,
      ...config?.tabAutocompleteOptions,
      ...llm.autocompleteOptions,
    };

    // Enable static contextualization if defined.
    if (config?.experimental?.enableStaticContextualization) {
      options.experimental_enableStaticContextualization = true;
    }

    return options;
  }

  // 辅助函数：计算遥测数据
  private calculateTelemetryData(
    llmStartTime: number,
    firstTokenTime: number | undefined,
    llm: ILLM,
    completion: string,
    prompt: string,
  ) {
    const totalTime = Date.now() - llmStartTime;
    const toFirstToken = firstTokenTime
      ? firstTokenTime - llmStartTime
      : undefined;
    const generatedTokens = llm.countTokens(completion);
    const promptTokens = llm.countTokens(prompt);
    const tokensPerSecond =
      toFirstToken && generatedTokens > 0
        ? generatedTokens / ((totalTime - toFirstToken) / 1000)
        : undefined;

    return {
      totalTime,
      toFirstToken,
      generatedTokens,
      promptTokens,
      tokensPerSecond,
    };
  }

  public async provideInlineCompletionItems(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
    force?: boolean,
  ): Promise<AutocompleteOutcome | undefined> {
    // 在函数级别声明遥测变量，确保在所有作用域中可用
    let firstTokenTime: number | undefined;
    let llmStartTime: number | undefined;
    const startTime = Date.now(); // 提升到函数级别，确保在 catch 中可以访问

    try {
      // Create abort signal if not given
      if (!token) {
        const controller = this.loggingService.createAbortController(
          input.completionId,
        );
        token = controller.signal;
      }

      // 触发autocomplete时立即上报telemetry事件
      const triggeredEvent = {
        completionId: input.completionId,
        filepath: input.filepath,
        isUntitledFile: input.isUntitledFile,
        position: {
          line: input.pos.line,
          character: input.pos.character,
        },
        timestamp: new Date().toISOString(),
        force: force || false,
      };
      void Telemetry.capture("autocomplete_triggered", triggeredEvent);

      const llm = await this._prepareLlm();
      if (!llm) {
        return undefined;
      }

      if (isSecurityConcern(input.filepath)) {
        return undefined;
      }

      const options = await this._getAutocompleteOptions(llm);

      // Debounce
      if (!force) {
        if (
          await this.debouncer.delayAndShouldDebounce(options.debounceDelay)
        ) {
          return undefined;
        }
      }

      if (llm.promptTemplates?.autocomplete) {
        options.template = llm.promptTemplates.autocomplete as string;
      }

      const helper = await HelperVars.create(
        input,
        options,
        llm.model,
        this.ide,
      );

      if (await shouldPrefilter(helper, this.ide)) {
        return undefined;
      }

      const [snippetPayload, workspaceDirs] = await Promise.all([
        getAllSnippetsWithoutRace({
          helper,
          ide: this.ide,
          getDefinitionsFromLsp: this.getDefinitionsFromLsp,
          contextRetrievalService: this.contextRetrievalService,
        }),
        this.ide.getWorkspaceDirs(),
      ]);

      const { prompt, prefix, suffix, completionOptions } =
        renderPromptWithTokenLimit({
          snippetPayload,
          workspaceDirs,
          helper,
          llm,
        });

      // Completion
      let completion: string | undefined = "";
      const cache = await this.getCache();
      const cachedCompletion = helper.options.useCache
        ? await cache.get(helper.prunedPrefix)
        : undefined;
      let cacheHit = false;
      if (cachedCompletion) {
        cacheHit = true;
        completion = cachedCompletion;
      } else {
        const multiline =
          !helper.options.transform || shouldCompleteMultiline(helper);

        // 记录LLM请求开始
        const llmRequestStartEventTime = Date.now();
        const requestStartEvent = {
          completionId: input.completionId,
          filepath: input.filepath,
          modelProvider: llm.underlyingProviderName,
          modelName: llm.model,
          promptLength: prompt.length,
          prefixLength: prefix.length,
          suffixLength: suffix.length,
          multiline: multiline,
          timestamp: new Date().toISOString(),
          timeSinceTriggered: llmRequestStartEventTime - startTime, // 从请求开始到LLM请求开始的时间
          timeSinceStart: 0, // LLM刚启动，所以为0
        };

        void Telemetry.capture(
          "autocomplete_llm_request_start",
          requestStartEvent,
        );

        // 记录LLM开始时间
        llmStartTime = Date.now();

        const completionStream =
          this.completionStreamer.streamCompletionWithFilters(
            token,
            llm,
            prefix,
            suffix,
            prompt,
            multiline,
            completionOptions,
            helper,
            (timestamp) => {
              firstTokenTime = timestamp;
            },
          );

        for await (const update of completionStream) {
          completion += update;
        }

        // 计算遥测数据
        const {
          totalTime,
          toFirstToken,
          generatedTokens,
          promptTokens,
          tokensPerSecond,
        } = this.calculateTelemetryData(
          llmStartTime!,
          firstTokenTime,
          llm,
          completion,
          prompt,
        );

        // 记录LLM请求成功完成（合并遥测数据）
        const llmRequestSuccessEventTime = Date.now();
        const requestSuccessEvent = {
          completionId: input.completionId,
          filepath: input.filepath,
          modelProvider: llm.underlyingProviderName,
          modelName: llm.model,
          timestamp: new Date().toISOString(),
          // 新增的遥测数据
          totalTime,
          toFirstToken,
          tokensPerSecond,
          promptTokens,
          generatedTokens,
          timeSinceTriggered: llmRequestSuccessEventTime - startTime, // 从请求开始到成功上报的时间
          timeSinceStart: llmRequestSuccessEventTime - llmStartTime!, // 从LLM开始到成功上报的时间
        };
        void Telemetry.capture(
          "autocomplete_llm_request_success",
          requestSuccessEvent,
        );

        // Don't postprocess if aborted
        if (token.aborted) {
          // 记录autocomplete被取消的事件
          const cancelledEventTime = Date.now();
          const cancelledEvent = {
            completionId: input.completionId,
            filepath: input.filepath,
            isUntitledFile: input.isUntitledFile,
            position: {
              line: input.pos.line,
              character: input.pos.character,
            },
            timestamp: new Date().toISOString(),
            reason: "aborted_during_generation",
            processingTime: cancelledEventTime - startTime,
            timeSinceTriggered: cancelledEventTime - startTime, // 从请求开始到取消上报的时间
          };

          // 合并遥测数据到取消事件中
          const {
            totalTime: cancelledTotalTime,
            toFirstToken: cancelledToFirstToken,
            generatedTokens: cancelledGeneratedTokens,
            promptTokens: cancelledPromptTokens,
            tokensPerSecond: cancelledTokensPerSecond,
          } = this.calculateTelemetryData(
            llmStartTime!,
            firstTokenTime,
            llm,
            completion,
            prompt,
          );

          // 重新构建取消事件，包含遥测数据
          const enhancedCancelledEvent = {
            ...cancelledEvent,
            totalTime: cancelledTotalTime,
            toFirstToken: cancelledToFirstToken,
            tokensPerSecond: cancelledTokensPerSecond,
            promptTokens: cancelledPromptTokens,
            generatedTokens: cancelledGeneratedTokens,
            timeSinceStart: cancelledEventTime - llmStartTime!, // 从LLM开始到取消上报的时间
          };
          void Telemetry.capture(
            "autocomplete_cancelled",
            enhancedCancelledEvent,
          );

          return undefined;
        }

        const processedCompletion = helper.options.transform
          ? postprocessCompletion({
              completion,
              prefix: helper.prunedPrefix,
              suffix: helper.prunedSuffix,
              llm,
            })
          : completion;

        completion = processedCompletion;
      }

      if (!completion) {
        const emptyEventTime = Date.now();
        const emptyEvent = {
          completionId: input.completionId,
          filepath: input.filepath,
          isUntitledFile: input.isUntitledFile,
          position: {
            line: input.pos.line,
            character: input.pos.character,
          },
          timestamp: new Date().toISOString(),
          reason: "empty_completion",
          processingTime: emptyEventTime - startTime,
          timeSinceTriggered: emptyEventTime - startTime, // 从请求开始到空补全上报的时间
          modelProvider: llm.underlyingProviderName,
          modelName: llm.model,
          completionLength: 0,
          cacheHit,
        };

        // 合并遥测数据到空补全事件中
        if (llmStartTime !== undefined) {
          const {
            totalTime: emptyTotalTime,
            toFirstToken: emptyToFirstToken,
            promptTokens: emptyPromptTokens,
          } = this.calculateTelemetryData(
            llmStartTime,
            firstTokenTime,
            llm,
            "",
            prompt,
          );

          // 重新构建空补全事件，包含遥测数据
          const enhancedEmptyEvent = {
            ...emptyEvent,
            totalTime: emptyTotalTime,
            toFirstToken: emptyToFirstToken,
            tokensPerSecond: undefined, // 空补全没有生成token
            promptTokens: emptyPromptTokens,
            generatedTokens: 0,
            timeSinceStart: emptyEventTime - llmStartTime!, // 从LLM开始到空补全上报的时间
          };
          void Telemetry.capture("autocomplete_cancelled", enhancedEmptyEvent);
        } else {
          // 如果没有遥测上下文，至少发送基本的空补全事件
          void Telemetry.capture("autocomplete_cancelled", emptyEvent);
        }

        return undefined;
      }

      const outcome: AutocompleteOutcome = {
        time: Date.now() - startTime,
        completion,
        prefix,
        suffix,
        prompt,
        modelProvider: llm.underlyingProviderName,
        modelName: llm.model,
        completionOptions,
        cacheHit,
        filepath: helper.filepath,
        numLines: completion.split("\n").length,
        completionId: helper.input.completionId,
        gitRepo: await this.ide.getRepoName(helper.filepath),
        uniqueId: await this.ide.getUniqueId(),
        timestamp: new Date().toISOString(),
        profileType:
          this.configHandler.currentProfile?.profileDescription.profileType,
        ...helper.options,
      };

      if (options.experimental_enableStaticContextualization) {
        outcome.enabledStaticContextualization = true;
      }

      if (!outcome.cacheHit && helper.options.useCache) {
        void cache
          .put(outcome.prefix, outcome.completion)
          .catch((e) => console.warn(`Failed to save to cache: ${e.message}`));
      }

      const ideType = (await this.ide.getIdeInfo()).ideType;
      if (ideType === "jetbrains") {
        this.markDisplayed(input.completionId, outcome);
      }

      return outcome;
    } catch (e: any) {
      // 记录LLM请求失败
      const errorEventTime = Date.now();
      const requestFailedEvent = {
        completionId: input.completionId,
        filepath: input.filepath,
        errorMessage: e.message || "Unknown error",
        errorType: e.constructor?.name || "Unknown",
        errorStatus: e.status || e.code || "N/A",
        timestamp: new Date().toISOString(),
        timeSinceTriggered: errorEventTime - startTime, // 从请求开始到失败上报的时间
      };

      void Telemetry.capture(
        "autocomplete_llm_request_failed",
        requestFailedEvent,
      );

      const errorCancelledEvent = {
        completionId: input.completionId,
        filepath: input.filepath,
        isUntitledFile: input.isUntitledFile,
        position: {
          line: input.pos.line,
          character: input.pos.character,
        },
        timestamp: new Date().toISOString(),
        reason: "error_during_processing",
        errorMessage: e.message || "Unknown error",
        errorType: e.constructor?.name || "Unknown",
        errorStatus: e.status || e.code || "N/A",
        timeSinceTriggered: errorEventTime - startTime, // 从请求开始到错误取消上报的时间
      };

      // 发送增强的错误遥测数据
      if (llmStartTime !== undefined) {
        const errorTotalTime = Date.now() - llmStartTime;
        const errorToFirstToken = firstTokenTime
          ? firstTokenTime - llmStartTime
          : undefined;
        const errorPromptTokens = 0; // 错误情况下无法获取llm实例
        const errorGeneratedTokens = 0; // 错误情况下没有生成内容

        // 重新构建错误事件，包含遥测数据
        const enhancedErrorEvent = {
          ...errorCancelledEvent,
          totalTime: errorTotalTime,
          toFirstToken: errorToFirstToken,
          tokensPerSecond: undefined, // 错误情况不计算tokensPerSecond
          promptTokens: errorPromptTokens,
          generatedTokens: errorGeneratedTokens,
          timeSinceStart: errorEventTime - llmStartTime, // 从LLM开始到错误上报的时间
        };
        void Telemetry.capture("autocomplete_cancelled", enhancedErrorEvent);
      }

      this.onError(e);
    } finally {
      this.loggingService.deleteAbortController(input.completionId);
    }
  }

  public async dispose() {
    if (this.autocompleteCache) {
      await this.autocompleteCache.close();
    }
  }
}
