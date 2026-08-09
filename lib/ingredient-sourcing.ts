export type PurchaseChannel = "german_supermarket" | "asian_market";

export type IngredientTranslationSeed = {
  id: string;
  zh: string;
  en: string;
  de: string;
  channel: PurchaseChannel;
  category: string;
  shelfHint: string;
  detailNote: string;
  verified: boolean;
};

export const purchaseChannelLabels: Record<PurchaseChannel, string> = {
  german_supermarket: "德国普通超市",
  asian_market: "亚超调料与特殊食材",
};

export const ingredientTranslationSeeds: IngredientTranslationSeed[] = [
  {
    id: "filet",
    zh: "菲力／里脊",
    en: "fillet / tenderloin",
    de: "Filet",
    channel: "german_supermarket",
    category: "肉类部位",
    shelfHint: "肉柜或冷藏肉类区；搜索时加动物名称，例如 Rinderfilet、Schweinefilet。",
    detailNote: "Filet 是部位词，不是固定的一种肉；菜谱必须同时保存动物种类和切块要求。",
    verified: false,
  },
  {
    id: "date",
    zh: "椰枣",
    en: "date",
    de: "Dattel",
    channel: "german_supermarket",
    category: "干果",
    shelfHint: "Trockenfrüchte 干果区；包装常见 Datteln 或 Medjool-Datteln。",
    detailNote: "区分去核 entsteint、品种和含水度；它们会影响甜度、重量和打泥效果。",
    verified: false,
  },
  {
    id: "baking-powder",
    zh: "泡打粉",
    en: "baking powder",
    de: "Backpulver",
    channel: "german_supermarket",
    category: "烘焙",
    shelfHint: "Backzutaten 烘焙原料区，通常按小袋销售。",
    detailNote: "需要按包装标注的适用面粉量换算，不能默认一袋等于固定克数。",
    verified: false,
  },
  {
    id: "light-soy-sauce",
    zh: "生抽",
    en: "light soy sauce",
    de: "helle Sojasauce",
    channel: "asian_market",
    category: "酱油",
    shelfHint: "亚洲超市酱油区；德国普通超市的 Sojasauce 不一定等同于中式生抽。",
    detailNote: "保存品牌、咸度和是否标注 glutenfrei；不能仅凭颜色判断。",
    verified: false,
  },
  {
    id: "dark-soy-sauce",
    zh: "老抽",
    en: "dark soy sauce",
    de: "dunkle Sojasauce",
    channel: "asian_market",
    category: "酱油",
    shelfHint: "亚洲超市酱油区；搜索 dark soy sauce 或 dunkle Sojasauce。",
    detailNote: "主要作用通常是上色，但甜度和咸度因品牌不同，需保留原配方品牌或实测备注。",
    verified: false,
  },
  {
    id: "oyster-sauce",
    zh: "蚝油",
    en: "oyster sauce",
    de: "Austernsauce",
    channel: "asian_market",
    category: "复合调味料",
    shelfHint: "亚洲超市调味酱区；素食替代品需单独标为 vegetarische Austernsauce。",
    detailNote: "过敏原、麸质与配方差异必须以具体包装为准。",
    verified: false,
  },
];

export function groupIngredientTranslations(items = ingredientTranslationSeeds) {
  return {
    germanSupermarket: items.filter((item) => item.channel === "german_supermarket"),
    asianMarket: items.filter((item) => item.channel === "asian_market"),
  };
}

