import type { FavoriteVideo, NormalizedFavoriteVideo, Recipe } from "./types";

type ExportMetadata = {
  fileName?: string;
  collectionId?: string;
  collectionTitle?: string;
  exportedAt?: string;
};

export type PreparedBilibiliImport = ExportMetadata & {
  videos: NormalizedFavoriteVideo[];
  skipped: Array<{ index: number; title: string; reason: string }>;
};

const stringValue = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();

function findVideoArray(data: unknown): FavoriteVideo[] {
  if (Array.isArray(data)) return data as FavoriteVideo[];
  if (!data || typeof data !== "object") return [];
  const object = data as Record<string, unknown>;
  for (const key of ["videos", "items", "medias", "favorites", "data"]) {
    const value = object[key];
    if (Array.isArray(value)) return value as FavoriteVideo[];
    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      for (const nestedKey of ["videos", "items", "medias", "list"]) {
        if (Array.isArray(nested[nestedKey])) return nested[nestedKey] as FavoriteVideo[];
      }
    }
  }
  return [];
}

export function normalizeFavoriteVideo(video: FavoriteVideo): NormalizedFavoriteVideo | null {
  const bvid = stringValue(video.bvid || video.bvId || video.id);
  const url = stringValue(video.video_url || video.url) || (bvid ? `https://www.bilibili.com/video/${bvid}` : "");
  if (!bvid || !url || video.invalid) return null;
  const duration = Number(video.duration_seconds ?? video.duration);
  return {
    bvid,
    title: stringValue(video.title) || "待整理视频",
    url,
    uploader: stringValue(video.uploader || video.author),
    description: stringValue(video.intro || video.description),
    coverUrl: stringValue(video.cover_url || video.cover).replace(/^http:\/\//, "https://"),
    durationSeconds: Number.isFinite(duration) && duration >= 0 ? duration : undefined,
    publishedAt: stringValue(video.published_at) || undefined,
    favoritedAt: stringValue(video.favorited_at) || undefined,
    favoriteId: stringValue(video.favorite_id) || undefined,
    invalid: Boolean(video.invalid),
    raw: video,
  };
}

export function prepareBilibiliImport(data: unknown, fileName?: string): PreparedBilibiliImport {
  const rawVideos = findVideoArray(data);
  if (!rawVideos.length) throw new Error("没有识别到视频列表");
  const videos: NormalizedFavoriteVideo[] = [];
  const skipped: PreparedBilibiliImport["skipped"] = [];
  rawVideos.forEach((video, index) => {
    const normalized = normalizeFavoriteVideo(video);
    if (normalized) videos.push(normalized);
    else skipped.push({ index: index + 1, title: stringValue(video.title) || "未命名", reason: video.invalid ? "源文件标记为失效" : "缺少 BV 号或链接" });
  });
  const root = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const favorite = root.favorite && typeof root.favorite === "object" ? root.favorite as Record<string, unknown> : {};
  return {
    fileName,
    collectionId: stringValue(favorite.id) || videos[0]?.favoriteId,
    collectionTitle: stringValue(favorite.title),
    exportedAt: stringValue(root.exported_at),
    videos,
    skipped,
  };
}

export function recipeFromFavoriteVideo(video: NormalizedFavoriteVideo): Recipe {
  return {
    id: `video-${video.bvid.toLowerCase()}`,
    title: video.title,
    summary: video.description && video.description !== "-" ? video.description : "已从 B 站收藏夹导入，等待整理为结构化菜谱。",
    emoji: "🎬",
    color: "linear-gradient(135deg,#d8d3c9,#9ca69f)",
    servings: 2,
    totalMinutes: 0,
    difficulty: "简单",
    status: "inbox",
    visibility: "private",
    tags: ["待整理", "B站导入"],
    tools: [],
    source: {
      platform: "Bilibili",
      title: video.title,
      url: video.url,
      bvid: video.bvid,
      uploader: video.uploader,
      coverUrl: video.coverUrl,
      durationSeconds: video.durationSeconds,
      publishedAt: video.publishedAt,
      favoritedAt: video.favoritedAt,
    },
    ingredients: [],
    steps: [],
    versionNote: "由收藏夹 JSON 导入；食材、用量、步骤、火候和准备时间均尚待人工核验。",
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}
