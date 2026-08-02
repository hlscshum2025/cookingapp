export type Ingredient = { name: string; amount?: number; unit?: string; preparation?: string; optional?: boolean };
export type Step = { instruction: string; durationMinutes?: number; temperatureC?: number };
export type CookingLog = { id: string; cookedAt: string; rating: number; result: "success"|"needs_work"; notes: string };
export type Recipe = { id:string; title:string; summary:string; status:"inbox"|"to_try"|"successful"|"needs_work"|"favorite"; visibility:"private"|"public"; servings:number; totalMinutes?:number; difficulty:"easy"|"medium"|"hard"; sourceUrl?:string; sourceTitle?:string; coverUrl?:string; tags:string[]; tools:string[]; ingredients:Ingredient[]; steps:Step[]; logs:CookingLog[]; updatedAt:string };
export type SourceVideo = { id:string; externalId:string; title:string; url:string; uploaderName?:string; coverUrl?:string; description?:string; availability?:string };
