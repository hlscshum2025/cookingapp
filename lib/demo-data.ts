import type { CookingLog, IngredientMapping, Recipe } from "./types";

export const demoRecipes: Recipe[] = [
  {
    id: "tomato-beef",
    title: "番茄炖牛腩",
    summary: "酸甜浓郁、适合周末批量做的暖胃炖菜；这是减少糖量后的个人版本。",
    emoji: "🍲", color: "linear-gradient(135deg,#efb38c,#d96749)", servings: 4, totalMinutes: 110,
    difficulty: "中等", status: "favorite", visibility: "public", tags: ["正餐","肉食主义","无麸质待核验"], tools: ["炖锅"],
    source: { platform: "Bilibili", title: "番茄牛腩这样做汤汁拌饭绝了", url: "https://www.bilibili.com", bvid: "BV1DEMO001", uploader: "示例UP主" },
    ingredients: [
      { id:"i1",name:"牛腩",amount:"600",unit:"g",preparation:"切块" }, { id:"i2",name:"番茄",amount:"4",unit:"个",preparation:"去皮切块" },
      { id:"i3",name:"洋葱",amount:"1",unit:"个",preparation:"切丁" }, { id:"i4",name:"生抽",amount:"2",unit:"汤匙",preparation:"确认无麸质版本" },
    ],
    steps: [
      { id:"s1",instruction:"牛腩冷水下锅，煮出浮沫后捞出洗净。",minutes:12 },
      { id:"s2",instruction:"少油炒香洋葱，加入一半番茄炒至出沙。",minutes:8,tip:"番茄分两次放，汤汁和口感都会更好。" },
      { id:"s3",instruction:"加入牛腩和热水，小火炖 70 分钟。",minutes:70 },
      { id:"s4",instruction:"加入剩余番茄和调味料，再炖 15 分钟后收汁。",minutes:15 },
    ], versionNote:"第二次制作：糖从 15g 减到 5g，番茄增加一个。", updatedAt:"2026-08-01"
  },
  {
    id:"air-fryer-chicken", title:"空气炸锅蒜香鸡腿", summary:"工作日晚餐版本，提前腌好，回家后 25 分钟完成。", emoji:"🍗", color:"linear-gradient(135deg,#f2c574,#d98e3c)",
    servings:2,totalMinutes:35,difficulty:"简单",status:"successful",visibility:"public",tags:["快手菜","高蛋白","空气炸锅"],tools:["空气炸锅"],
    source:{platform:"Bilibili",title:"空气炸锅鸡腿外脆里嫩",url:"https://www.bilibili.com",bvid:"BV1DEMO002",uploader:"示例厨房"},
    ingredients:[{id:"c1",name:"鸡腿",amount:"4",unit:"只"},{id:"c2",name:"蒜",amount:"5",unit:"瓣",preparation:"切末"},{id:"c3",name:"甜椒粉",amount:"1",unit:"茶匙"}],
    steps:[{id:"cs1",instruction:"鸡腿擦干后划两刀，与全部调味料混合腌制。",minutes:10},{id:"cs2",instruction:"空气炸锅 190°C 烤 18 分钟，中途翻面。",minutes:18},{id:"cs3",instruction:"升至 205°C 再烤 4 分钟上色。",minutes:4}],
    versionNote:"下次蒜量可增加，盐维持现在用量。",updatedAt:"2026-07-29"
  },
  {
    id:"pumpkin-soup",title:"烤南瓜浓汤",summary:"不加面粉的顺滑浓汤，适合秋冬早餐或西餐配汤。",emoji:"🥣",color:"linear-gradient(135deg,#f5d483,#df9f3f)",servings:3,totalMinutes:50,difficulty:"简单",status:"successful",visibility:"private",tags:["西餐","早餐","无麸质"],tools:["烤箱","料理机"],
    ingredients:[{id:"p1",name:"贝贝南瓜",amount:"500",unit:"g"},{id:"p2",name:"洋葱",amount:"0.5",unit:"个"},{id:"p3",name:"牛奶",amount:"250",unit:"ml"}],
    steps:[{id:"ps1",instruction:"南瓜和洋葱刷薄油，200°C 烤至焦香。",minutes:30},{id:"ps2",instruction:"与热牛奶一起打至顺滑。",minutes:5},{id:"ps3",instruction:"回锅加热并用盐、黑胡椒调味。",minutes:5}],versionNote:"已验证：不需要加面粉也足够浓稠。",updatedAt:"2026-07-24"
  },
  {
    id:"scallion-noodles",title:"葱油拌面",summary:"正在把视频中的调料比例换算成一人份，尚未实际制作。",emoji:"🍜",color:"linear-gradient(135deg,#b9d07f,#67895a)",servings:1,totalMinutes:20,difficulty:"简单",status:"to_try",visibility:"private",tags:["面食","快手菜","待尝试"],tools:["炒锅"],ingredients:[{id:"n1",name:"面条",amount:"120",unit:"g"},{id:"n2",name:"小葱",amount:"4",unit:"根"}],steps:[{id:"ns1",instruction:"低温将葱段炸至焦黄，捞出。",minutes:10},{id:"ns2",instruction:"加入调味汁煮开，与面条拌匀。",minutes:5}],versionNote:"调味用量等待第一次制作校准。",updatedAt:"2026-07-20"
  }
];

export const demoLogs: CookingLog[] = [
  { id:"l1",recipeId:"tomato-beef",cookedAt:"2026-07-31",rating:5,result:"success",changes:"少糖、多放一个番茄",notes:"汤汁酸甜平衡，第二天更入味。",nextTime:"试试用德国超市的 Suppenfleisch。" },
  { id:"l2",recipeId:"air-fryer-chicken",cookedAt:"2026-07-27",rating:4,result:"success",changes:"最后 4 分钟提高温度",notes:"表皮很脆，里面没有干。",nextTime:"蒜末增加到 7 瓣。" },
];

export const demoIngredients: IngredientMapping[] = [
  {id:"m1",zh:"牛腩",en:"beef brisket",de:"Rinderbrust",category:"肉类",germanHint:"Rinderbrust / Suppenfleisch，购买时询问具体部位",gluten:"否",verified:true},
  {id:"m2",zh:"生抽",en:"light soy sauce",de:"helle Sojasauce",category:"调味料",germanHint:"亚洲超市；无麸质需找明确标注 glutenfrei 的产品",gluten:"需核验",verified:false},
  {id:"m3",zh:"玉米淀粉",en:"corn starch",de:"Maisstärke",category:"淀粉",germanHint:"Backzutaten 货架，常见包装写 Speisestärke",gluten:"需核验",verified:false},
  {id:"m4",zh:"小葱",en:"spring onion",de:"Frühlingszwiebel",category:"蔬菜",germanHint:"蔬果区，也可能标 Lauchzwiebel",gluten:"否",verified:true},
  {id:"m5",zh:"贝贝南瓜",en:"kabocha squash",de:"Hokkaido-Kürbis",category:"蔬菜",germanHint:"德国常用 Hokkaido 替代，含水量和甜度需按菜调整",gluten:"否",verified:true},
];
