/**
 * 模型配置 —— 从 LearnBuddy 平台动态读取可用模型，选择 flash 系列（排除 pro）。
 *
 * 不在源码中硬编码具体供应商名称：模型 ID 由平台在运行时返回，
 * 代码只按「flash / 非 pro / 版本号」这些语义特征选择默认模型。
 */
import { unstable_v2_createSession } from "@tencent-ai/agent-sdk";

export interface ModelOption {
  modelId: string;
  name: string;
  description?: string;
}

let cachedModels: ModelOption[] | null = null;
let cachedDefaultId: string | null = null;

async function loadModels(): Promise<ModelOption[]> {
  if (cachedModels) return cachedModels;
  try {
    const session = await unstable_v2_createSession({ cwd: process.cwd() });
    const models = (await session.getAvailableModels()) ?? [];
    cachedModels = models.filter(
      (m): m is ModelOption => !!m && typeof m.modelId === "string"
    );
  } catch {
    cachedModels = [];
  }
  return cachedModels;
}

function isFlash(m: ModelOption): boolean {
  return /flash/i.test(m.modelId) && !/pro/i.test(m.modelId);
}

/**
 * 选择默认模型：优先 flash 4.1，其次任意 flash，最后任意非 pro。
 * 解析失败返回空字符串，调用方据此「不指定模型」（交给平台默认）。
 */
export async function getDefaultModelId(): Promise<string> {
  if (cachedDefaultId !== null) return cachedDefaultId;
  if (process.env.SOUL_LAB_MODEL) {
    cachedDefaultId = process.env.SOUL_LAB_MODEL;
    return cachedDefaultId;
  }
  const models = await loadModels();
  const nonPro = models.filter((m) => !/pro/i.test(m.modelId));
  const flash = nonPro.filter((m) => /flash/i.test(m.modelId));
  const preferred =
    flash.find((m) => /4\.1|v4p1/i.test(m.modelId)) ??
    flash[0] ??
    nonPro[0];
  cachedDefaultId = preferred?.modelId ?? "";
  return cachedDefaultId;
}

/** 平台可用的 flash 系列模型（供 /api/models 返回，已剔除 pro）。 */
export async function getFlashModels(): Promise<ModelOption[]> {
  const models = await loadModels();
  return models.filter(isFlash);
}

/** 清除模型缓存（环境变量变更后重新解析）。 */
export function clearModelCache(): void {
  cachedModels = null;
  cachedDefaultId = null;
}
