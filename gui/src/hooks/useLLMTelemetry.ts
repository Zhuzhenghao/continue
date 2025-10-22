import { useEffect } from "react";
import { useGuiTelemetry } from "./useGuiTelemetry";
import { LLMInteraction } from "./useLLMLog";

// 全局的telemetry发送记录，防止重复发送
const sentTelemetryIds = new Set<string>();

/**
 * 独立的LLM Telemetry Hook
 * 通过扩展模式而非直接修改核心文件来减少合并冲突
 */
export function useLLMTelemetry(interaction: LLMInteraction, summary: any) {
  const { sendTelemetry } = useGuiTelemetry();

  // 使用useEffect来发送telemetry，确保只在交互真正结束时发送一次
  useEffect(() => {
    if (interaction.start && interaction.end) {
      const interactionId = `interaction_${interaction.start.timestamp}`;

      // 检查是否已经发送过这个交互的telemetry
      if (!sentTelemetryIds.has(interactionId)) {
        // 只在有明确结果且不是取消时发送telemetry
        if (summary.result !== "") {
          sendTelemetry("gui_telemetry_stats", {
            interactionId: interaction.start.timestamp,
            type: summary.type,
            result: summary.result,
            totalTime: summary.totalTime,
            toFirstToken: summary.toFirstToken,
            tokensPerSecond: summary.tokensPerSecond,
            promptTokens: interaction.end.promptTokens,
            generatedTokens: interaction.end.generatedTokens,
            thinkingTokens: interaction.end.thinkingTokens,
            costBreakdown: summary.costBreakdown,
            provider: interaction.start.provider,
            model: interaction.start.options?.model,
          });

          // 标记这个交互已经发送过telemetry
          sentTelemetryIds.add(interactionId);
        }
      }
    }
  }, [interaction.start, interaction.end, sendTelemetry, summary]);
}
