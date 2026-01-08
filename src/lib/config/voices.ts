/**
 * MiniMax TTS 音色配置
 *
 * 精选 12 种常用音色，覆盖不同性别、年龄、风格
 * 音色 ID 来自 MiniMax Speech API
 */

export interface VoiceConfig {
  id: string; // MiniMax voice_id
  name: string; // 中文显示名称
  nameEn: string; // 英文名称
  gender: "male" | "female";
  ageGroup: "child" | "young" | "adult" | "senior";
  style: string; // 风格描述
}

export const VOICE_PRESETS: VoiceConfig[] = [
  // === 男声 ===
  {
    id: "male-qn-qingse",
    name: "青涩青年",
    nameEn: "Young Man - Fresh",
    gender: "male",
    ageGroup: "young",
    style: "清新、青涩、邻家男孩感",
  },
  {
    id: "male-qn-jingying",
    name: "精英男声",
    nameEn: "Young Man - Elite",
    gender: "male",
    ageGroup: "young",
    style: "自信、干练、职场精英",
  },
  {
    id: "male-qn-badao",
    name: "霸道总裁",
    nameEn: "Young Man - Dominant",
    gender: "male",
    ageGroup: "adult",
    style: "低沉、霸气、有压迫感",
  },
  {
    id: "male-qn-daxuesheng",
    name: "阳光大学生",
    nameEn: "College Student",
    gender: "male",
    ageGroup: "young",
    style: "阳光、活力、正能量",
  },
  {
    id: "presenter_male",
    name: "磁性男主播",
    nameEn: "Male Presenter",
    gender: "male",
    ageGroup: "adult",
    style: "磁性、专业、适合旁白",
  },
  {
    id: "audiobook_male_1",
    name: "沧桑大叔",
    nameEn: "Mature Uncle",
    gender: "male",
    ageGroup: "senior",
    style: "沧桑、稳重、有故事感",
  },

  // === 女声 ===
  {
    id: "female-shaonv",
    name: "温柔少女",
    nameEn: "Gentle Girl",
    gender: "female",
    ageGroup: "young",
    style: "温柔、甜美、治愈系",
  },
  {
    id: "female-yujie",
    name: "知性御姐",
    nameEn: "Elegant Lady",
    gender: "female",
    ageGroup: "adult",
    style: "知性、成熟、有魅力",
  },
  {
    id: "female-chengshu",
    name: "成熟女性",
    nameEn: "Mature Woman",
    gender: "female",
    ageGroup: "adult",
    style: "稳重、可靠、职业感",
  },
  {
    id: "female-tianmei",
    name: "甜美萝莉",
    nameEn: "Sweet Loli",
    gender: "female",
    ageGroup: "child",
    style: "甜美、可爱、元气满满",
  },
  {
    id: "presenter_female",
    name: "女主播",
    nameEn: "Female Presenter",
    gender: "female",
    ageGroup: "adult",
    style: "专业、清晰、适合解说",
  },
  {
    id: "audiobook_female_1",
    name: "温婉女声",
    nameEn: "Gentle Narrator",
    gender: "female",
    ageGroup: "adult",
    style: "温婉、有书卷气、适合有声书",
  },
];

/**
 * 根据 ID 获取音色配置
 */
export function getVoiceById(voiceId: string): VoiceConfig | undefined {
  return VOICE_PRESETS.find((v) => v.id === voiceId);
}

/**
 * 根据性别筛选音色
 */
export function getVoicesByGender(gender: "male" | "female"): VoiceConfig[] {
  return VOICE_PRESETS.filter((v) => v.gender === gender);
}

/**
 * 验证音色 ID 是否有效
 */
export function isValidVoiceId(voiceId: string): boolean {
  return VOICE_PRESETS.some((v) => v.id === voiceId);
}

/**
 * 获取音色显示名称
 */
export function getVoiceDisplayName(voiceId: string): string {
  const voice = getVoiceById(voiceId);
  return voice?.name || voiceId;
}

/**
 * 获取所有音色列表（用于 Agent 描述）
 */
export function getVoiceListDescription(): string {
  const males = VOICE_PRESETS.filter((v) => v.gender === "male")
    .map((v) => `${v.name}(${v.id})`)
    .join("、");
  const females = VOICE_PRESETS.filter((v) => v.gender === "female")
    .map((v) => `${v.name}(${v.id})`)
    .join("、");
  return `男声：${males}\n女声：${females}`;
}
