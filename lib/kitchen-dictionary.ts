export type KitchenEntryKind="ingredient"|"tool";
export type PurchaseChannel="german_supermarket"|"asian_market"|"both"|"not_applicable";

export type KitchenDictionaryEntry={
  id:string;
  kind:KitchenEntryKind;
  zh:string;
  aliases:string[];
  en:string;
  de:string;
  category:string;
  channel:PurchaseChannel;
  shelfHint?:string;
  note?:string;
};

const I=(id:string,zh:string,aliases:string[],en:string,de:string,category:string,channel:PurchaseChannel,shelfHint="",note=""):KitchenDictionaryEntry=>({id,kind:"ingredient",zh,aliases,en,de,category,channel,shelfHint,note});
const T=(id:string,zh:string,aliases:string[],en:string,de:string,category:string,note=""):KitchenDictionaryEntry=>({id,kind:"tool",zh,aliases,en,de,category,channel:"not_applicable",note});

export const kitchenDictionary:KitchenDictionaryEntry[]=[
  I("scallion","小葱",["葱","香葱","葱花"],"scallion / spring onion","Frühlingszwiebel","蔬菜","both","Gemüse 区"),
  I("leek-onion","大葱",["京葱","长葱"],"Chinese leek / large scallion","Lauchzwiebel / Frühlingszwiebel (groß)","蔬菜","asian_market","亚超蔬菜区","德国超市的 Lauch 通常指欧洲大葱/韭葱，和中式大葱并不完全相同。"),
  I("ginger","生姜",["姜","老姜","嫩姜"],"ginger","Ingwer","香辛蔬菜","both","Gemüse 区"),
  I("garlic","大蒜",["蒜","蒜瓣","蒜头"],"garlic","Knoblauch","香辛蔬菜","both","Gemüse 区"),
  I("cilantro","香菜",["芫荽","香荽"],"cilantro / coriander leaves","Koriandergrün / frischer Koriander","香草","both","Kräuter 区"),
  I("potato","土豆",["马铃薯","洋芋","薯仔"],"potato","Kartoffel","根茎","german_supermarket","Gemüse 区"),
  I("tomato","番茄",["西红柿"],"tomato","Tomate","蔬菜","german_supermarket","Gemüse 区"),
  I("onion","洋葱",["圆葱","皮牙子"],"onion","Zwiebel","蔬菜","german_supermarket","Gemüse 区"),
  I("red-onion","红洋葱",["紫洋葱"],"red onion","rote Zwiebel","蔬菜","german_supermarket","Gemüse 区"),
  I("cucumber","黄瓜",["青瓜"],"cucumber","Gurke","蔬菜","german_supermarket","Gemüse 区"),
  I("carrot","胡萝卜",["红萝卜"],"carrot","Karotte / Möhre","根茎","german_supermarket","Gemüse 区","Karotte 与 Möhre 都很常见，地区用词略有差别。"),
  I("daikon","白萝卜",["萝卜"],"daikon / white radish","Daikon / weißer Rettich","根茎","both","亚洲超市更稳定；部分德国超市有 Rettich"),
  I("eggplant","茄子",["矮瓜"],"eggplant / aubergine","Aubergine","蔬菜","german_supermarket","Gemüse 区"),
  I("bell-pepper","彩椒",["甜椒","灯笼椒","柿子椒"],"bell pepper / sweet pepper","Paprika","蔬菜","german_supermarket","Gemüse 区"),
  I("green-pepper","青椒",["绿色甜椒"],"green bell pepper","grüne Paprika","蔬菜","german_supermarket","Gemüse 区"),
  I("pointed-pepper","尖椒",["长青椒","杭椒"],"long green pepper / pointed pepper","Spitzpaprika / grüne Peperoni","蔬菜","both","Gemüse 区或亚超","辣度差异很大，最好按外形和辣度核对。"),
  I("bird-eye-chili","小米椒",["朝天椒","小辣椒"],"bird's eye chili","Bird's-Eye-Chili / Thai-Chili","辣椒","both","亚超更稳定"),
  I("napa-cabbage","大白菜",["白菜","黄芽白"],"napa cabbage / Chinese cabbage","Chinakohl","叶菜","german_supermarket","Gemüse 区"),
  I("baby-napa","娃娃菜",["小白菜心"],"baby napa cabbage","Mini-Chinakohl","叶菜","both","亚超更常见"),
  I("bok-choy","小白菜",["青菜","上海青","油菜"],"bok choy / pak choi","Pak Choi","叶菜","both","部分大型德国超市也常见"),
  I("lettuce","生菜",["莴苣叶"],"lettuce","Salat","叶菜","german_supermarket","Gemüse 区"),
  I("spinach","菠菜",[],"spinach","Spinat","叶菜","german_supermarket","Gemüse / Tiefkühl 区"),
  I("celery","西芹",["芹菜"],"celery","Stangensellerie","蔬菜","german_supermarket","Gemüse 区","中式芹菜更细更香，德国普通超市常见的是 Stangensellerie。"),
  I("broccoli","西兰花",["绿花椰菜"],"broccoli","Brokkoli","蔬菜","german_supermarket","Gemüse 区"),
  I("cauliflower","菜花",["花菜","花椰菜"],"cauliflower","Blumenkohl","蔬菜","german_supermarket","Gemüse 区"),
  I("chives","韭菜",["韭黄"],"Chinese chives / garlic chives","Knoblauchschnittlauch","叶菜","asian_market","亚超蔬菜区","普通 Schnittlauch 是细香葱，不等同于中式韭菜。"),
  I("lotus-root","莲藕",["藕"],"lotus root","Lotuswurzel","根茎","asian_market","亚超冷藏/蔬菜区"),
  I("yam","山药",["淮山","怀山"],"Chinese yam","Yamswurzel / chinesische Yamswurzel","根茎","asian_market","亚超蔬菜区"),
  I("winter-melon","冬瓜",[],"winter melon / wax gourd","Wintermelone / Wachskürbis","瓜类","asian_market","亚超蔬菜区"),
  I("pumpkin","南瓜",["倭瓜"],"pumpkin / squash","Kürbis","瓜类","german_supermarket","Gemüse 区"),
  I("corn","玉米",["苞米","棒子"],"corn / maize","Mais","谷物蔬菜","german_supermarket","Gemüse / Konserven / Tiefkühl 区"),
  I("shiitake","香菇",["冬菇"],"shiitake mushroom","Shiitake-Pilz","菌菇","both","鲜品在 Gemüse，干品亚超更常见"),
  I("enoki","金针菇",[],"enoki mushroom","Enoki-Pilz","菌菇","asian_market","亚超冷藏区"),
  I("wood-ear","木耳",["黑木耳","云耳"],"wood ear mushroom","Mu-Err-Pilz / Judasohren","菌菇","asian_market","亚超干货区"),
  I("lemon","柠檬",[],"lemon","Zitrone","水果","german_supermarket","Obst 区"),
  I("lime","青柠",["莱姆"],"lime","Limette","水果","german_supermarket","Obst 区"),
  I("passion-fruit","百香果",["西番莲"],"passion fruit","Passionsfrucht / Maracuja","水果","german_supermarket","Obst 区"),
  I("apple","苹果",[],"apple","Apfel","水果","german_supermarket","Obst 区"),
  I("pear","梨",["雪梨","鸭梨"],"pear","Birne","水果","german_supermarket","Obst 区"),
  I("date","椰枣",["海枣"],"date","Dattel","干果","german_supermarket","Trockenfrüchte 区"),
  I("egg","鸡蛋",["蛋"],"egg","Ei","蛋类","german_supermarket","Eier 区"),
  I("chicken-thigh","鸡腿",["鸡腿肉","去骨鸡腿","鸡大腿"],"chicken thigh","Hähnchenschenkel / Hähnchenoberkeule","禽肉","german_supermarket","Fleisch / Geflügel 区"),
  I("chicken-breast","鸡胸肉",["鸡胸"],"chicken breast","Hähnchenbrust","禽肉","german_supermarket","Geflügel 区"),
  I("pork-belly","五花肉",["五花","三层肉"],"pork belly","Schweinebauch","猪肉","german_supermarket","Fleisch 区"),
  I("pork-tenderloin","猪里脊",["里脊肉","猪柳"],"pork tenderloin","Schweinefilet","猪肉","german_supermarket","Fleisch 区"),
  I("pork-ribs","排骨",["猪排骨","肋排"],"pork ribs","Schweinerippchen / Spareribs","猪肉","german_supermarket","Fleisch 区"),
  I("beef-brisket","牛腩",["牛肋条"],"beef brisket / stewing beef","Rinderbrust / Rindergulasch","牛肉","german_supermarket","Fleisch 区","德超分切方式与中式牛腩不完全一致，炖煮可优先找 Rindergulasch 或 Rinderbrust。"),
  I("beef-tenderloin","牛里脊",["牛菲力","菲力牛排"],"beef tenderloin","Rinderfilet","牛肉","german_supermarket","Fleisch 区"),
  I("ground-beef","牛肉末",["牛绞肉"],"ground beef / minced beef","Rinderhackfleisch","牛肉","german_supermarket","Fleisch 区"),
  I("lamb","羊肉",["羊腿肉"],"lamb","Lammfleisch","羊肉","german_supermarket","Fleisch 区"),
  I("salmon","三文鱼",["鲑鱼"],"salmon","Lachs","水产","german_supermarket","Fisch / Kühlung 区"),
  I("shrimp","虾",["虾仁","大虾"],"shrimp / prawn","Garnele","水产","german_supermarket","Fisch / Tiefkühl 区"),
  I("tofu","豆腐",["北豆腐","老豆腐"],"tofu","Tofu","豆制品","both","Bio/Kühlregal 或亚超","嫩豆腐、老豆腐硬度差异明显。"),
  I("silken-tofu","嫩豆腐",["内酯豆腐","绢豆腐"],"silken tofu","Seidentofu","豆制品","both","Bio/Kühlregal 或亚超"),
  I("rice","大米",["米","白米"],"rice","Reis","主食","german_supermarket","Reis 区"),
  I("sticky-rice","糯米",["江米"],"glutinous rice / sticky rice","Klebreis","主食","asian_market","亚超米粮区"),
  I("wheat-flour","面粉",["中筋面粉","普通面粉"],"all-purpose flour","Weizenmehl Type 405 / 550","烘焙主食","german_supermarket","Backzutaten 区","中筋面粉与德国面粉 Type 体系不能完全一一对应，需按用途选择。"),
  I("cake-flour","低筋面粉",[],"cake flour","Weizenmehl Type 405 (ähnlich)","烘焙主食","german_supermarket","Backzutaten 区"),
  I("bread-flour","高筋面粉",[],"bread flour / strong flour","Weizenmehl Type 550 / Brotmehl","烘焙主食","german_supermarket","Backzutaten 区"),
  I("cornstarch","玉米淀粉",["粟粉"],"cornstarch","Maisstärke","淀粉","german_supermarket","Backzutaten 区"),
  I("potato-starch","土豆淀粉",["马铃薯淀粉","太白粉"],"potato starch","Kartoffelstärke","淀粉","german_supermarket","Backzutaten 区"),
  I("sweet-potato-starch","红薯淀粉",["地瓜粉","番薯粉"],"sweet potato starch","Süßkartoffelstärke","淀粉","asian_market","亚超粉类区"),
  I("noodles","面条",["挂面"],"noodles","Nudeln","主食","both","Nudeln 区或亚超"),
  I("salt","盐",["食盐"],"salt","Salz","基础调味","german_supermarket","Gewürze 区"),
  I("sugar","白砂糖",["白糖","砂糖"],"granulated sugar","Zucker / Haushaltszucker","基础调味","german_supermarket","Backzutaten 区"),
  I("rock-sugar","冰糖",["黄冰糖"],"rock sugar","Kandiszucker","基础调味","both","Tee/Backzutaten；中式冰糖亚超更稳定"),
  I("light-soy","生抽",["酱油","鲜酱油"],"light soy sauce","helle Sojasauce","中式调味","asian_market","亚超酱油区","普通 Sojasauce 不一定等同中式生抽。"),
  I("dark-soy","老抽",["老抽酱油"],"dark soy sauce","dunkle Sojasauce","中式调味","asian_market","亚超酱油区"),
  I("oyster-sauce","蚝油",[],"oyster sauce","Austernsauce","中式调味","asian_market","亚超酱料区"),
  I("shaoxing-wine","料酒",["绍兴酒","黄酒"],"Chinese cooking wine / Shaoxing wine","Shaoxing-Kochwein / chinesischer Kochwein","中式调味","asian_market","亚超酒/调味区"),
  I("rice-vinegar","米醋",["白米醋"],"rice vinegar","Reisessig","醋","both","Essig 区或亚超"),
  I("chinkiang-vinegar","香醋",["镇江香醋"],"Chinkiang vinegar / black rice vinegar","Chinkiang-Essig / schwarzer Reisessig","醋","asian_market","亚超醋区"),
  I("aged-vinegar","陈醋",["山西陈醋"],"aged Chinese vinegar","chinesischer gereifter Essig","醋","asian_market","亚超醋区"),
  I("white-vinegar","白醋",[],"white vinegar","Branntweinessig / weißer Essig","醋","german_supermarket","Essig 区"),
  I("sesame-oil","香油",["芝麻油","麻油"],"sesame oil","Sesamöl","油脂","both","Öl 区或亚超"),
  I("neutral-oil","食用油",["植物油","炒菜油"],"neutral cooking oil","neutrales Pflanzenöl","油脂","german_supermarket","Öl 区"),
  I("sichuan-pepper","花椒",["青花椒","红花椒"],"Sichuan pepper","Szechuanpfeffer","香辛料","asian_market","亚超香料区"),
  I("star-anise","八角",["大料"],"star anise","Sternanis","香辛料","both","Gewürze 区或亚超"),
  I("cinnamon","桂皮",["肉桂皮"],"cassia bark / cinnamon","Cassia-Zimt / Zimtstange","香辛料","both","Gewürze 区"),
  I("bay-leaf","香叶",["月桂叶"],"bay leaf","Lorbeerblatt","香辛料","german_supermarket","Gewürze 区"),
  I("cumin","孜然",["孜然粒","孜然粉"],"cumin","Kreuzkümmel","香辛料","german_supermarket","Gewürze 区"),
  I("white-pepper","白胡椒",["白胡椒粉"],"white pepper","weißer Pfeffer","香辛料","german_supermarket","Gewürze 区"),
  I("black-pepper","黑胡椒",["黑胡椒粉"],"black pepper","schwarzer Pfeffer","香辛料","german_supermarket","Gewürze 区"),
  I("doubanjiang","豆瓣酱",["郫县豆瓣酱"],"doubanjiang / chili bean paste","Doubanjiang / chinesische Chili-Bohnenpaste","中式酱料","asian_market","亚超酱料区"),
  I("sweet-bean-paste","甜面酱",[],"sweet bean sauce","süße Bohnenpaste","中式酱料","asian_market","亚超酱料区"),
  I("yellow-bean-paste","黄豆酱",["大酱"],"soybean paste","Sojabohnenpaste","中式酱料","asian_market","亚超酱料区"),
  I("fermented-black-bean","豆豉",[],"fermented black beans","fermentierte schwarze Bohnen","中式酱料","asian_market","亚超干货/酱料区"),
  I("fermented-tofu","腐乳",["豆腐乳"],"fermented bean curd","fermentierter Tofu","中式酱料","asian_market","亚超酱料区"),
  I("msg","味精",[],"MSG / monosodium glutamate","Mononatriumglutamat / MSG","调味","asian_market","亚超调味区"),
  I("chicken-bouillon","鸡精",["鸡粉"],"chicken bouillon powder","Hühnerbrühepulver","调味","both","Brühe/Gewürze 区或亚超"),
  I("milk","牛奶",["鲜奶"],"milk","Milch","乳制品","german_supermarket","Milch/Kühlregal"),
  I("cream","淡奶油",["稀奶油","动物奶油"],"heavy cream / whipping cream","Schlagsahne","乳制品","german_supermarket","Kühlregal"),
  I("butter","黄油",["牛油"],"butter","Butter","乳制品","german_supermarket","Kühlregal"),
  I("yogurt","酸奶",["优格"],"yogurt","Joghurt","乳制品","german_supermarket","Kühlregal"),
  I("cream-cheese","奶油奶酪",["奶油芝士"],"cream cheese","Frischkäse","乳制品","german_supermarket","Kühlregal"),
  I("baking-powder","泡打粉",[],"baking powder","Backpulver","烘焙","german_supermarket","Backzutaten 区"),
  I("baking-soda","小苏打",["食用碱面"],"baking soda","Natron","烘焙","german_supermarket","Backzutaten 区"),
  I("dry-yeast","干酵母",["酵母粉"],"dry yeast","Trockenhefe","烘焙","german_supermarket","Backzutaten 区"),

  T("wok","炒锅",["铁锅","中式炒锅"],"wok","Wok","锅具"),
  T("frying-pan","平底锅",["煎锅"],"frying pan / skillet","Pfanne","锅具"),
  T("saucepan","奶锅",["小汤锅"],"saucepan","Stielkasserolle / kleiner Kochtopf","锅具"),
  T("stockpot","汤锅",["煮锅","深锅"],"stockpot / cooking pot","Kochtopf / Suppentopf","锅具"),
  T("steamer","蒸锅",["蒸屉"],"steamer","Dampfgarer / Dämpfeinsatz","锅具"),
  T("pressure-cooker","高压锅",["压力锅"],"pressure cooker","Schnellkochtopf","锅具"),
  T("rice-cooker","电饭煲",["电饭锅"],"rice cooker","Reiskocher","电器"),
  T("oven","烤箱",[],"oven","Backofen","电器"),
  T("air-fryer","空气炸锅",[],"air fryer","Heißluftfritteuse","电器"),
  T("microwave","微波炉",[],"microwave oven","Mikrowelle","电器"),
  T("chef-knife","菜刀",["厨刀"],"chef's knife / Chinese cleaver","Kochmesser / chinesisches Hackmesser","刀具"),
  T("paring-knife","削皮刀",["水果刀"],"paring knife","Schälmesser","刀具"),
  T("peeler","削皮器",["刨皮器"],"vegetable peeler","Sparschäler","刀具"),
  T("cutting-board","砧板",["案板","菜板"],"cutting board","Schneidebrett","备料工具"),
  T("kitchen-scissors","厨房剪刀",["食物剪"],"kitchen scissors","Küchenschere","备料工具"),
  T("rolling-pin","擀面杖",[],"rolling pin","Nudelholz","面点工具"),
  T("grater","刨丝器",["擦丝器","擦板"],"grater","Reibe / Küchenreibe","备料工具"),
  T("mandoline","切片器",["蔬菜切片器"],"mandoline slicer","Gemüsehobel / Mandoline","备料工具"),
  T("whisk","打蛋器",["手动打蛋器"],"whisk","Schneebesen","烘焙工具"),
  T("hand-mixer","电动打蛋器",[],"hand mixer","Handmixer","电器"),
  T("stand-mixer","厨师机",["料理机（厨师机）"],"stand mixer","Küchenmaschine","电器"),
  T("blender","搅拌机",["料理机","破壁机"],"blender","Standmixer","电器"),
  T("immersion-blender","手持搅拌棒",["手持料理棒"],"immersion blender / stick blender","Stabmixer","电器"),
  T("mortar-pestle","研钵和杵",["蒜臼","捣蒜钵","捣蒜锤","石臼"],"mortar and pestle","Mörser und Stößel","备料工具","“捣蒜锤”通常对应其中的杵 pestle / Stößel；整套工具是 mortar and pestle / Mörser und Stößel。"),
  T("garlic-press","压蒜器",["蒜泥器"],"garlic press","Knoblauchpresse","备料工具"),
  T("spatula","锅铲",["炒铲"],"spatula / turner","Pfannenwender","烹饪工具"),
  T("wood-spoon","木勺",[],"wooden spoon","Kochlöffel","烹饪工具"),
  T("ladle","汤勺",["大汤勺"],"ladle","Schöpfkelle","烹饪工具"),
  T("slotted-spoon","漏勺",[],"slotted spoon / skimmer","Schaumlöffel","烹饪工具"),
  T("tongs","食品夹",["夹子","烧烤夹"],"kitchen tongs","Küchenzange","烹饪工具"),
  T("sieve","筛子",["面粉筛"],"sieve / flour sifter","Sieb / Mehlsieb","烘焙工具"),
  T("strainer","滤网",["细网筛"],"fine-mesh strainer","Feinsieb","烹饪工具"),
  T("measuring-cup","量杯",[],"measuring cup","Messbecher","计量工具"),
  T("measuring-spoons","量勺",[],"measuring spoons","Messlöffel","计量工具"),
  T("kitchen-scale","厨房秤",["电子秤"],"kitchen scale","Küchenwaage","计量工具"),
  T("thermometer","厨房温度计",["探针温度计"],"food thermometer / probe thermometer","Küchenthermometer / Einstichthermometer","计量工具"),
  T("silicone-spatula","硅胶刮刀",["刮刀"],"silicone spatula","Silikonspatel / Teigschaber","烘焙工具"),
  T("pastry-brush","刷子",["油刷","烘焙刷"],"pastry brush","Backpinsel","烘焙工具"),
  T("mixing-bowl","搅拌盆",["料理盆","打蛋盆"],"mixing bowl","Rührschüssel","容器"),
  T("colander","沥水篮",["滤盆"],"colander","Seiher / Durchschlag","容器")
];

export const purchaseChannelLabels:Record<PurchaseChannel,string>={
  german_supermarket:"德国普通超市",
  asian_market:"亚超优先",
  both:"德超 / 亚超均可",
  not_applicable:"不适用",
};

function normalize(value:string){return value.trim().toLowerCase().replace(/[\s·・\/（）()]+/g,"");}

export function findKitchenEntry(name:string,kind?:KitchenEntryKind){
  const target=normalize(name);
  if(!target)return undefined;
  return kitchenDictionary.find(entry=>{
    if(kind&&entry.kind!==kind)return false;
    return [entry.zh,...entry.aliases].some(alias=>normalize(alias)===target);
  });
}

export function searchKitchenDictionary(query:string,kind:"all"|KitchenEntryKind="all"){
  const target=query.trim().toLowerCase();
  return kitchenDictionary.filter(entry=>{
    if(kind!=="all"&&entry.kind!==kind)return false;
    if(!target)return true;
    return [entry.zh,...entry.aliases,entry.en,entry.de,entry.category,entry.shelfHint||"",entry.note||""].join(" ").toLowerCase().includes(target);
  });
}
