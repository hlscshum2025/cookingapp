export type RecipeStatus = "inbox" | "to_try" | "successful" | "needs_work" | "favorite";

export type IngredientLine = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  preparation?: string;
  group?: string;
};

export type RecipeStep = { id: string; instruction: string; minutes?: number; tip?: string };

export type CookingLog = {
  id: string;
  recipeId: string;
  cookedAt: string;
  rating: number;
  result: "success" | "okay" | "failed";
  changes: string;
  notes: string;
  nextTime: string;
  photoPath?: string;
  photoUrl?: string;
};

export type Recipe = {
  id: string;
  title: string;
  summary: string;
  emoji: string;
  color: string;
  servings: number;
  totalMinutes: number;
  activeMinutes?: number;
  unattendedMinutes?: number;
  advancePrepMinutes?: number;
  advancePrepNote?: string;
  difficulty: "简单" | "中等" | "进阶";
  status: RecipeStatus;
  visibility: "private" | "public";
  tags: string[];
  tools: string[];
  source?: {
    platform: string;
    title: string;
    url: string;
    bvid?: string;
    uploader?: string;
    coverUrl?: string;
    durationSeconds?: number;
    publishedAt?: string;
    favoritedAt?: string;
  };
  ingredients: IngredientLine[];
  steps: RecipeStep[];
  versionNote: string;
  updatedAt: string;
};

export type PublicationStatus = "pending" | "approved" | "rejected";

export type PublicRecipe = {
  recipeId: string;
  publicationRequestId: string;
  publishedAt: string;
  recipe: Recipe;
};

export type PublicationRequest = {
  id: string;
  recipeId: string;
  ownerId: string;
  title: string;
  summary: string;
  status: PublicationStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
  recipe: Recipe;
};

export type IngredientMapping = {
  id: string;
  zh: string;
  en: string;
  de: string;
  category: string;
  germanHint: string;
  gluten: "是" | "否" | "需核验";
  verified: boolean;
};

export type FavoriteVideo = {
  bvid?: string;
  bvId?: string;
  id?: string | number;
  title?: string;
  url?: string;
  video_url?: string;
  uploader?: string;
  author?: string;
  description?: string;
  intro?: string;
  cover?: string;
  cover_url?: string;
  duration?: number | string;
  duration_seconds?: number;
  published_at?: string;
  favorited_at?: string;
  favorite_id?: string;
  uploader_mid?: number;
  index?: number;
  invalid?: boolean;
};

export type NormalizedFavoriteVideo = {
  bvid: string;
  title: string;
  url: string;
  uploader: string;
  description: string;
  coverUrl: string;
  durationSeconds?: number;
  publishedAt?: string;
  favoritedAt?: string;
  favoriteId?: string;
  invalid: boolean;
  raw: FavoriteVideo;
};

export type SourceVideo = {
  id: string;
  platform: string;
  externalId: string;
  url: string;
  title: string;
  uploaderName: string;
  coverUrl: string;
  description: string;
  availability: string;
  durationSeconds?: number;
  publishedAt?: string;
  favoritedAt?: string;
  updatedAt: string;
};

export type ImportItemStatus = "processed" | "duplicate" | "failed" | "skipped";

export type ImportItemAudit = {
  externalId: string;
  title: string;
  status: ImportItemStatus;
  errorCode?: string;
};

export type ImportResult = {
  jobId: string;
  mode: "local" | "cloud";
  total: number;
  added: number;
  duplicates: number;
  failed: number;
  skipped: number;
  items: ImportItemAudit[];
};

export type ImportJobSummary = {
  id: string;
  fileName?: string;
  sourceCollectionId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  total: number;
  added: number;
  duplicates: number;
  failed: number;
  skipped: number;
  createdAt: string;
  finishedAt?: string;
};
