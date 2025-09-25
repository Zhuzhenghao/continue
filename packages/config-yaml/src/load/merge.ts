import { RequestOptions } from "../browser.js";
import { AssistantUnrolled, ConfigYaml } from "../schemas/index.js";

export function mergePackages(
  current: ConfigYaml,
  incoming: ConfigYaml,
): ConfigYaml {
  return {
    ...current,
    models: [...(current.models ?? []), ...(incoming.models ?? [])],
    context: [...(current.context ?? []), ...(incoming.context ?? [])],
    data: [...(current.data ?? []), ...(incoming.data ?? [])],
    mcpServers: [...(current.mcpServers ?? []), ...(incoming.mcpServers ?? [])],
    rules: [...(current.rules ?? []), ...(incoming.rules ?? [])],
    prompts: [...(current.prompts ?? []), ...(incoming.prompts ?? [])],
    docs: [...(current.docs ?? []), ...(incoming.docs ?? [])],
    env: { ...current.env, ...incoming.env },
    requestOptions: mergeConfigYamlRequestOptions(
      current.requestOptions,
      incoming.requestOptions,
    ),
  };
}

export function mergeUnrolledAssistants(
  current: AssistantUnrolled,
  incoming: AssistantUnrolled,
): AssistantUnrolled {
  return {
    ...current,
    rules: [...(current.rules ?? []), ...(incoming.rules ?? [])],
    models: [...(current.models ?? []), ...(incoming.models ?? [])],
    docs: [...(current.docs ?? []), ...(incoming.docs ?? [])],
    context: [...(current.context ?? []), ...(incoming.context ?? [])],
    data: [...(current.data ?? []), ...(incoming.data ?? [])],
    mcpServers: [...(current.mcpServers ?? []), ...(incoming.mcpServers ?? [])],
    prompts: [...(current.prompts ?? []), ...(incoming.prompts ?? [])],
    env: { ...current.env, ...incoming.env },
    requestOptions: mergeConfigYamlRequestOptions(
      current.requestOptions,
      incoming.requestOptions,
    ),
  };
}

export function ensureBuiltinModels(
  userConfig: AssistantUnrolled,
  builtinModels: any[],
): AssistantUnrolled {
  // Filter out user models that have the same name as builtin models
  const userModelsWithoutConflicts = (userConfig.models ?? []).filter(
    (model) =>
      !model?.name ||
      !builtinModels.some((builtin) => builtin?.name === model.name),
  );

  // Add all builtin models (they will override any user models with the same name)
  const result: AssistantUnrolled = {
    ...userConfig,
    models: [...userModelsWithoutConflicts, ...builtinModels],
  };

  return result;
}

export function mergeConfigYamlRequestOptions(
  base: RequestOptions | undefined,
  global: RequestOptions | undefined,
): RequestOptions | undefined {
  if (!base && !global) {
    return undefined;
  }
  if (!base) {
    return global;
  }
  if (!global) {
    return base;
  }

  const headers = {
    ...global.headers,
    ...base.headers,
  };

  return {
    ...global,
    ...base, // base overrides for simple values as well as noProxy and extraBodyProperties
    headers: Object.keys(headers).length === 0 ? undefined : headers, // headers are the only thing that really merge
  };
}
