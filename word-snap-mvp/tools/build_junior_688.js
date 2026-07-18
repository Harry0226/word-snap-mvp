const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "word-data", "sources", "junior-high-frequency-688.txt");
const stageDir = path.join(root, "word-data", "stages");
const words = fs.readFileSync(sourcePath, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

if (words.length !== 688 || new Set(words).size !== 688) {
  throw new Error(`初中688高频词源文件应包含 688 个不重复单词，实际为 ${words.length}/${new Set(words).size}`);
}

const context = { window: {} };
vm.createContext(context);
for (const name of fs.readdirSync(stageDir).filter((name) => name.endsWith(".js") && name !== "junior-high-frequency-688.js")) {
  vm.runInContext(fs.readFileSync(path.join(stageDir, name), "utf8"), context, { filename: name });
}

const stagePriority = [
  "初一考试词汇", "初一课内词汇", "初二考试词汇", "初二课内词汇",
  "初三考试词汇", "初三课内词汇", "高一考试词汇", "高一课内词汇",
  "高一课改词库", "高二考试词汇", "高二课内词汇", "高三考试词汇"
];
const existingMeanings = new Map();
for (const stage of stagePriority) {
  for (const item of context.window.WORD_SNAP_STAGE_LISTS?.[stage]?.words || []) {
    const key = String(item.en || "").trim().toLowerCase();
    if (key && item.zh && !existingMeanings.has(key)) existingMeanings.set(key, String(item.zh).trim());
  }
}

// PDF 只有英文。优先复用项目已审核释义；这里补齐缺词，并把少数偏义或过长释义收敛为初中常用义。
const reviewedMeanings = {
  ability: "能力",
  absent: "缺席的",
  achieve: "达到；实现",
  ache: "疼痛",
  advertisement: "广告",
  already: "已经",
  amaze: "使惊奇",
  anyway: "无论如何",
  apartment: "公寓",
  army: "军队",
  arrive: "到达",
  athlete: "运动员",
  autumn: "秋天",
  award: "奖；授予",
  band: "乐队；带子",
  bath: "洗澡；浴缸",
  because: "因为",
  block: "街区；阻挡",
  butterfly: "蝴蝶",
  calendar: "日历",
  capital: "首都；资本",
  careful: "小心的；仔细的",
  ceiling: "天花板",
  chain: "链条",
  cheat: "欺骗；作弊",
  church: "教堂",
  cinema: "电影院",
  circle: "圆圈",
  clinic: "诊所",
  cloudy: "多云的",
  coal: "煤",
  coast: "海岸",
  common: "常见的；共同的",
  continue: "继续",
  contest: "比赛；竞赛",
  cooker: "炊具",
  correct: "正确的；改正",
  crowd: "人群；聚集",
  cruel: "残忍的",
  custom: "习俗；风俗",
  damage: "损害；损坏",
  daughter: "女儿",
  deaf: "聋的",
  decorate: "装饰",
  dentist: "牙医",
  destroy: "破坏",
  die: "死亡",
  disease: "疾病",
  disable: "使残疾；使失去能力",
  discuss: "讨论",
  doubt: "怀疑",
  dozen: "一打；十二个",
  driver: "司机",
  drug: "药物；毒品",
  dull: "无聊的；迟钝的",
  educate: "教育",
  either: "两者之一；也（用于否定句）",
  electric: "电的",
  enemy: "敌人",
  envelope: "信封",
  everybody: "每个人",
  examination: "考试",
  excellent: "优秀的",
  except: "除……之外",
  excuse: "借口；原谅",
  excite: "使兴奋",
  expensive: "昂贵的",
  express: "表达；快递",
  expression: "表情；表达",
  fall: "落下；秋天",
  farmer: "农民",
  fence: "栅栏",
  fever: "发烧",
  fine: "好的；罚款",
  flat: "公寓；平的",
  flood: "洪水；淹没",
  fuel: "燃料",
  gas: "气体；燃气",
  gesture: "手势",
  guard: "保卫；警卫",
  hang: "悬挂",
  headline: "标题",
  hungry: "饥饿的",
  hurry: "匆忙",
  influence: "影响",
  instruction: "指示；说明",
  iron: "铁；熨烫",
  item: "项目；物品",
  junior: "初级的；青少年的",
  kick: "踢",
  last: "持续；最后的",
  leaf: "叶子",
  litter: "垃圾；乱扔",
  little: "少量的；小的",
  lovely: "可爱的；令人愉快的",
  machine: "机器",
  medal: "奖牌",
  mend: "修理",
  menu: "菜单",
  message: "消息；信息",
  metal: "金属",
  mobile: "移动的；手机",
  monitor: "班长；监视",
  murder: "谋杀",
  must: "必须",
  nation: "国家；民族",
  national: "国家的；民族的",
  neighbor: "邻居",
  neighbour: "邻居",
  note: "笔记；注意",
  nowadays: "如今",
  operation: "手术；操作",
  opera: "歌剧",
  opposite: "相反的；对面",
  order: "命令；顺序；点餐",
  pale: "苍白的",
  passport: "护照",
  period: "时期；一段时间",
  physical: "身体的；物理的",
  pilot: "飞行员",
  pioneer: "先驱；先锋",
  plant: "植物；种植",
  pollute: "污染",
  pop: "流行音乐；突然出现",
  pour: "倒；倾泻",
  press: "新闻界；按压",
  private: "私人的",
  prisoner: "囚犯",
  produce: "生产；制造",
  progress: "进步；进展",
  promise: "承诺；答应",
  pupil: "学生",
  punish: "惩罚",
  rainy: "下雨的",
  recognize: "认出；承认",
  recently: "最近",
  refuse: "拒绝",
  regular: "有规律的；定期的",
  relation: "关系",
  repair: "修理",
  reply: "回复；回答",
  review: "复习；评论",
  rope: "绳子",
  round: "圆的；一轮",
  rubbish: "垃圾",
  rude: "粗鲁的",
  rush: "冲；匆忙",
  secretary: "秘书",
  senior: "高级的；年长的",
  separate: "分开的；分开",
  servant: "仆人",
  service: "服务",
  should: "应该",
  shut: "关闭",
  sightseeing: "观光",
  since: "自从；因为",
  smoke: "烟；吸烟",
  sort: "种类；分类",
  spring: "春天；泉水",
  straight: "直的；径直",
  steam: "蒸汽",
  supper: "晚餐",
  sunny: "晴朗的",
  swing: "摇摆",
  system: "系统",
  taste: "味道；品尝",
  theatre: "剧院",
  thirsty: "口渴的",
  thin: "薄的；瘦的",
  till: "直到",
  tidy: "整洁的；整理",
  toothache: "牙痛",
  trader: "商人",
  traffic: "交通",
  transport: "交通运输",
  truck: "卡车",
  view: "观点；景色",
  village: "村庄",
  voice: "声音；嗓音",
  waiter: "服务员",
  weak: "虚弱的",
  wealth: "财富",
  while: "当……时；一会儿",
  wing: "翅膀"
};

const entries = words.map((en) => ({
  en,
  zh: reviewedMeanings[en] || existingMeanings.get(en) || "",
  pos: "",
  notes: "",
  frequency: 0
}));
const missing = entries.filter((item) => !item.zh);
if (missing.length) throw new Error(`以下单词缺少中文释义：${missing.map((item) => item.en).join(", ")}`);

const digest = crypto.createHash("sha256").update(words.join("\n")).digest("hex");
const serializedEntries = entries.map((item) => `    ${JSON.stringify(item)}`).join(",\n");
const output = [
  "window.WORD_SNAP_STAGE_LISTS = window.WORD_SNAP_STAGE_LISTS || {};",
  `window.WORD_SNAP_STAGE_LISTS["初中688高频词"] = {"grade":"初中688高频词","goals":["初中688高频词"],"source":"初中688高频词（PDF）","sourceSha256":"${digest}","words":[`,
  serializedEntries,
  "]};",
  ""
].join("\n");

process.stdout.write(output);
