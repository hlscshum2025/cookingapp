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
};

export type Recipe = {
  id: string;
  title: string;
  summary: string;
  emoji: string;
  color: string;
  servings: number;
  totalMinutes: number;
  difficulty: "简单" | "中等" | "进阶";
  status: RecipeStatus;
  visibility: "private" | "public";
  tags: string[];
  tools: string[];
  source?: { platform: string; title: string; url: string; bvid?: string; uploader?: string };
  ingredients: IngredientLine[];
  steps: RecipeStep[];
  versionNote: string;
  updatedAt: string;
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
  uploader?: string;
  author?: string;
  description?: string;
  cover?: string;
  duration?: number | string;
  invalid?: boolean;
};
