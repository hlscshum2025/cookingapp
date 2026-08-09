export type CostAllocation =
  | { mode: "quantity"; usedAmount: number; usedUnit: string }
  | { mode: "uses"; estimatedUses: number }
  | { mode: "fixed"; fixedAmount: number };

export type IngredientCostInput = {
  id: string;
  name: string;
  purchasePrice: number;
  currency: string;
  packageAmount?: number;
  packageUnit?: string;
  edibleYield?: number;
  allocation: CostAllocation;
};

export type IngredientCostResult = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  estimated: boolean;
  method: CostAllocation["mode"];
};

const units: Record<string, { dimension: "mass" | "volume" | "count"; factor: number }> = {
  mg: { dimension: "mass", factor: 0.001 },
  g: { dimension: "mass", factor: 1 },
  kg: { dimension: "mass", factor: 1000 },
  ml: { dimension: "volume", factor: 1 },
  cl: { dimension: "volume", factor: 10 },
  dl: { dimension: "volume", factor: 100 },
  l: { dimension: "volume", factor: 1000 },
  个: { dimension: "count", factor: 1 },
  枚: { dimension: "count", factor: 1 },
  只: { dimension: "count", factor: 1 },
  piece: { dimension: "count", factor: 1 },
};

function unitDefinition(unit: string) {
  const normalized = unit.trim().toLowerCase();
  const definition = units[normalized];
  if (!definition) throw new Error(`暂不支持单位“${unit}”。`);
  return definition;
}

export function convertAmount(amount: number, fromUnit: string, toUnit: string): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("用量必须是非负数。");
  const from = unitDefinition(fromUnit);
  const to = unitDefinition(toUnit);
  if (from.dimension !== to.dimension) {
    throw new Error(`单位不兼容：${fromUnit} 不能直接换算为 ${toUnit}。`);
  }
  return amount * from.factor / to.factor;
}

export function calculateIngredientCost(input: IngredientCostInput): IngredientCostResult {
  if (!Number.isFinite(input.purchasePrice) || input.purchasePrice < 0) {
    throw new Error(`${input.name}的购买价格无效。`);
  }
  const yieldRatio = input.edibleYield ?? 1;
  if (!(yieldRatio > 0 && yieldRatio <= 1)) throw new Error(`${input.name}的可食率必须大于 0 且不超过 1。`);

  let amount = 0;
  if (input.allocation.mode === "quantity") {
    if (!input.packageAmount || input.packageAmount <= 0 || !input.packageUnit) {
      throw new Error(`${input.name}缺少包装净含量或包装单位。`);
    }
    const usedInPackageUnit = convertAmount(
      input.allocation.usedAmount,
      input.allocation.usedUnit,
      input.packageUnit,
    );
    amount = input.purchasePrice * usedInPackageUnit / (input.packageAmount * yieldRatio);
  } else if (input.allocation.mode === "uses") {
    if (!Number.isFinite(input.allocation.estimatedUses) || input.allocation.estimatedUses <= 0) {
      throw new Error(`${input.name}的预计使用次数必须大于 0。`);
    }
    amount = input.purchasePrice / input.allocation.estimatedUses;
  } else {
    if (!Number.isFinite(input.allocation.fixedAmount) || input.allocation.fixedAmount < 0) {
      throw new Error(`${input.name}的固定估价无效。`);
    }
    amount = input.allocation.fixedAmount;
  }

  return {
    id: input.id,
    name: input.name,
    amount,
    currency: input.currency,
    estimated: input.allocation.mode !== "quantity",
    method: input.allocation.mode,
  };
}

export function calculateRecipeCost(inputs: IngredientCostInput[], servings: number) {
  if (!Number.isFinite(servings) || servings <= 0) throw new Error("份数必须大于 0。");
  const lines = inputs.map(calculateIngredientCost);
  const currencies = new Set(lines.map((line) => line.currency));
  if (currencies.size > 1) throw new Error("同一次核算不能直接相加不同货币；请先选择显示汇率。");
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return {
    currency: lines[0]?.currency ?? "EUR",
    total,
    perServing: total / servings,
    estimated: lines.some((line) => line.estimated),
    lines,
  };
}

