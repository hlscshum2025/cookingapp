export type SubtitleCue = {
  from: number;
  to: number;
  text: string;
};

export type SubtitleTrack = {
  id: string;
  language: string;
  label: string;
  isAi: boolean;
  cues: SubtitleCue[];
};

export type SubtitleReviewDocument = {
  schemaVersion: string;
  video: {
    bvid: string;
    cid?: number;
    title: string;
    url: string;
  };
  tracks: SubtitleTrack[];
};

export type EvidenceKind = "subtitle" | "video_text" | "manual";

export type CandidateIngredient = {
  name: string;
  amount?: number;
  unit?: string;
  evidence: EvidenceKind;
  note?: string;
};

export type CandidateRecipe = {
  id: string;
  bvid: string;
  title: string;
  section: string;
  reviewStatus: "ready_for_review" | "needs_subtitle" | "needs_video_text";
  ingredients: CandidateIngredient[];
  steps: string[];
  missing: string[];
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readCues(value: unknown): SubtitleCue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const cue = asRecord(entry);
    if (!cue) return [];
    const from = asNumber(cue.from ?? cue.start ?? cue.startTime);
    const to = asNumber(cue.to ?? cue.end ?? cue.endTime);
    const textValue = cue.text ?? cue.content ?? cue.line;
    const text = typeof textValue === "string" ? textValue.trim() : "";
    if (from === undefined || to === undefined || !text) return [];
    return [{ from, to, text }];
  }).sort((a, b) => a.from - b.from);
}

export function parseBilibiliSubtitleExport(input: unknown): SubtitleReviewDocument {
  const root = asRecord(input);
  if (!root) throw new Error("字幕 JSON 的最外层必须是对象。");

  const videoInput = asRecord(root.video) ?? root;
  const bvidValue = videoInput.bvid ?? root.bvid;
  const bvid = typeof bvidValue === "string" ? bvidValue.trim() : "";
  if (!/^BV[0-9A-Za-z]+$/.test(bvid)) throw new Error("字幕 JSON 缺少有效的 BV 号。");

  const titleValue = videoInput.title ?? root.title;
  const title = typeof titleValue === "string" && titleValue.trim()
    ? titleValue.trim()
    : bvid;
  const urlValue = videoInput.url ?? root.url;
  const url = typeof urlValue === "string" && urlValue.trim()
    ? urlValue.trim()
    : `https://www.bilibili.com/video/${bvid}`;
  const cid = asNumber(videoInput.cid ?? root.cid);

  const trackInputs = Array.isArray(root.tracks)
    ? root.tracks
    : Array.isArray(root.subtitles)
      ? root.subtitles
      : [root];

  const tracks = trackInputs.flatMap((entry, index) => {
    const track = asRecord(entry);
    if (!track) return [];
    const cues = readCues(track.cues ?? track.body ?? track.lines ?? root.body);
    if (!cues.length) return [];
    const languageValue = track.language ?? track.lan ?? track.lang;
    const labelValue = track.label ?? track.lanDoc ?? track.lan_doc ?? track.title;
    const language = typeof languageValue === "string" ? languageValue : "unknown";
    const label = typeof labelValue === "string" ? labelValue : `字幕 ${index + 1}`;
    const isAi = track.isAi === true || track.ai_status === 1 || /AI|智能/i.test(label);
    return [{ id: String(track.id ?? track.subtitle_id ?? index), language, label, isAi, cues }];
  });

  if (!tracks.length) throw new Error("字幕 JSON 中没有可用的时间轴文本。");

  return {
    schemaVersion: typeof root.schemaVersion === "string"
      ? root.schemaVersion
      : "cookingapp-bilibili-subtitle-1",
    video: { bvid, cid, title, url },
    tracks,
  };
}

export const sampleCandidateRecipes: CandidateRecipe[] = [
  {
    id: "bv1cq-mantou",
    bvid: "BV1CQ4y1j7or",
    title: "馒头候选来源版",
    section: "单份配方",
    reviewStatus: "ready_for_review",
    ingredients: [
      { name: "面粉", amount: 500, unit: "g", evidence: "video_text" },
      { name: "酵母", amount: 5, unit: "g", evidence: "video_text" },
      { name: "糖", amount: 3, unit: "g", evidence: "video_text" },
      { name: "猪油", amount: 15, unit: "g", evidence: "video_text" },
      { name: "泡打粉", amount: 3, unit: "g", evidence: "video_text" },
      { name: "水", amount: 240, unit: "g", evidence: "video_text" },
    ],
    steps: [],
    missing: ["步骤时间轴需由 B 站 AI 字幕补齐", "发酵状态与蒸制时间待核验"],
  },
  ...["酸奶酱 1", "酸奶酱 2", "酸奶酱 3"].map((section, index): CandidateRecipe => ({
    id: `bv1jm-yogurt-${index + 1}`,
    bvid: "BV1JmbVzfEev",
    title: `${section}候选来源版`,
    section: "同一视频中的独立配方",
    reviewStatus: index === 2 ? "needs_video_text" : "needs_subtitle",
    ingredients: [],
    steps: [],
    missing: index === 2
      ? ["第三份配方的完整原料名称", "画面克数", "字幕步骤"]
      : ["画面克数待写入结构化字段", "字幕步骤待导入"],
  })),
];

