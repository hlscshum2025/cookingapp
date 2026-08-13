import type { Recipe, RecipeStatus, SourceVideo } from "./types";
import type { EvidenceKind, SubtitleReviewDocument } from "./video-review";

export type ReviewVerificationStatus = "unverified" | "ai_suggested" | "user_verified" | "source_verified";
export type ManualSourcePlatform = "bilibili" | "xiachufang" | "xiaohongshu" | "generic_web" | "manual";

export type ManualEvidence = {
  kind: EvidenceKind;
  from?: number;
  to?: number;
  note?: string;
};

export type ManualIngredient = Recipe["ingredients"][number] & {
  evidence: ManualEvidence;
};

export type ManualStep = Recipe["steps"][number] & {
  evidence: ManualEvidence;
};

export type ManualRecipeDraft = {
  source: {
    platform: ManualSourcePlatform;
    externalId: string;
    url: string;
    title: string;
    uploaderName: string;
    coverUrl: string;
    description: string;
    durationSeconds?: number;
  };
  recipe: Omit<Recipe, "ingredients" | "steps" | "source"> & {
    candidateKey: string;
    ingredients: ManualIngredient[];
    steps: ManualStep[];
  };
  subtitle?: SubtitleReviewDocument;
  review: {
    verificationStatus: ReviewVerificationStatus;
    note: string;
  };
};

export type ManualEntryPayload = {
  source: {
    platform: string;
    externalId: string | null;
    url: string | null;
    title: string | null;
    uploaderName: string | null;
    coverUrl: string | null;
    description: string | null;
    durationSeconds: number | null;
  };
  recipe: Recipe & {
    candidateKey: string;
    contentReview: {
      verificationStatus: ReviewVerificationStatus;
      note: string;
      subtitleCueCount: number;
      subtitleLanguage?: string;
      ingredientEvidence: Array<{ ingredientId: string; evidence: ManualEvidence }>;
      stepEvidence: Array<{ stepId: string; evidence: ManualEvidence }>;
    };
  };
  subtitle?: SubtitleReviewDocument;
  review: ManualRecipeDraft["review"];
};

export type ManualEntryResult = {
  recipeId: string;
  sourceVideoId?: string;
  versionId: string;
  versionNo: number;
};

const defaultEvidence = (): ManualEvidence => ({ kind: "manual" });
const supportedPlatforms = new Set<ManualSourcePlatform>(["bilibili","xiachufang","xiaohongshu","generic_web","manual"]);

export function sourcePlatformLabel(platform:ManualSourcePlatform){
  return ({
    bilibili:"Bilibili",
    xiachufang:"下厨房",
    xiaohongshu:"小红书",
    generic_web:"网页",
    manual:"手动来源",
  } as const)[platform];
}

export function createManualRowId(prefix: string) {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  return randomUuid ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createBlankManualDraft(): ManualRecipeDraft {
  return {
    source: {
      platform: "bilibili",
      externalId: "",
      url: "",
      title: "",
      uploaderName: "",
      coverUrl: "",
      description: "",
    },
    recipe: {
      id: "",
      candidateKey: "main",
      title: "",
      summary: "",
      emoji: "🍳",
      color: "linear-gradient(135deg,#e8c990,#d68353)",
      servings: 2,
      totalMinutes: 0,
      difficulty: "简单",
      status: "inbox" as RecipeStatus,
      visibility: "private",
      tags: [],
      tools: [],
      ingredients: [{ id: createManualRowId("ingredient"), name: "", amount: "", unit: "", evidence: defaultEvidence() }],
      steps: [{ id: createManualRowId("step"), instruction: "", evidence: defaultEvidence() }],
      versionNote: "手动录入的来源整理版；未知字段保持待核验。",
      updatedAt: new Date().toISOString().slice(0, 10),
    },
    review: { verificationStatus: "unverified", note: "" },
  };
}

export function createDraftFromSource(source?:SourceVideo):ManualRecipeDraft {
  const draft=createBlankManualDraft();
  if(!source)return draft;
  const platform=supportedPlatforms.has(source.platform as ManualSourcePlatform)
    ?source.platform as ManualSourcePlatform
    :"manual";
  return {
    ...draft,
    source:{
      platform,
      externalId:source.externalId,
      url:source.url,
      title:source.title,
      uploaderName:source.uploaderName,
      coverUrl:source.coverUrl,
      description:source.description,
      durationSeconds:source.durationSeconds,
    },
    recipe:{...draft.recipe,title:source.title,summary:source.description},
  };
}

function trimOrUndefined(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function prepareManualEntryPayload(draft: ManualRecipeDraft): ManualEntryPayload {
  const title = draft.recipe.title.trim();
  if (!title) throw new Error("请先填写菜名。");

  const externalId = draft.source.externalId.trim();
  if (draft.source.platform === "bilibili" && externalId && !/^BV[0-9A-Za-z]+$/.test(externalId)) {
    throw new Error("B 站 BV 号格式不正确。");
  }

  const candidateKey = draft.recipe.candidateKey.trim() || "main";
  const ingredients = draft.recipe.ingredients
    .filter((item) => item.name.trim())
    .map((item) => ({ id: item.id, name: item.name.trim(), amount: item.amount.trim(), unit: item.unit.trim(), preparation: item.preparation, group: item.group }));
  const steps = draft.recipe.steps
    .filter((item) => item.instruction.trim())
    .map((item) => ({ id: item.id, instruction: item.instruction.trim(), minutes: item.minutes, tip: item.tip }));

  const url = trimOrUndefined(draft.source.url)
    ?? (draft.source.platform==="bilibili"&&externalId ? `https://www.bilibili.com/video/${externalId}` : undefined);
  const sourceTitle = trimOrUndefined(draft.source.title) ?? title;
  const cueCount = draft.subtitle?.tracks.reduce((total, track) => total + track.cues.length, 0) ?? 0;

  return {
    source: {
      platform: draft.source.platform,
      externalId: externalId || null,
      url: url ?? null,
      title: sourceTitle,
      uploaderName: trimOrUndefined(draft.source.uploaderName) ?? null,
      coverUrl: trimOrUndefined(draft.source.coverUrl) ?? null,
      description: trimOrUndefined(draft.source.description) ?? null,
      durationSeconds: draft.source.durationSeconds ?? null,
    },
    recipe: {
      ...draft.recipe,
      id: draft.recipe.id.trim(),
      candidateKey,
      title,
      summary: draft.recipe.summary.trim(),
      tags: draft.recipe.tags.map((item) => item.trim()).filter(Boolean),
      tools: draft.recipe.tools.map((item) => item.trim()).filter(Boolean),
      ingredients,
      steps,
      source: url ? {
        platform: sourcePlatformLabel(draft.source.platform),
        title: sourceTitle,
        url,
        bvid: draft.source.platform==="bilibili"?(externalId||undefined):undefined,
        uploader: trimOrUndefined(draft.source.uploaderName),
        coverUrl: trimOrUndefined(draft.source.coverUrl),
        durationSeconds: draft.source.durationSeconds,
      } : undefined,
      contentReview: {
        verificationStatus: draft.review.verificationStatus,
        note: draft.review.note.trim(),
        subtitleCueCount: cueCount,
        subtitleLanguage: draft.subtitle?.tracks[0]?.language,
        ingredientEvidence: draft.recipe.ingredients
          .filter((item) => item.name.trim())
          .map((item) => ({ ingredientId: item.id, evidence: item.evidence })),
        stepEvidence: draft.recipe.steps
          .filter((item) => item.instruction.trim())
          .map((item) => ({ stepId: item.id, evidence: item.evidence })),
      },
      updatedAt: new Date().toISOString().slice(0, 10),
    },
    subtitle: draft.subtitle,
    review: draft.review,
  };
}
