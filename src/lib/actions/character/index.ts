/**
 * Character Actions
 * 角色相关的服务端操作
 */

// CRUD 操作
export { upsertCharacter, deleteCharacter } from "./crud";

// 角色信息更新
export { updateCharacterInfo, updateCharacterStyleInfo, createCharacterStyle } from "./style";

// 图片管理
export {
  generateImageForCharacterStyle,
  regenerateCharacterStyleImage,
  saveCharacterImage,
  deleteCharacterImage,
  setCharacterPrimaryImage,
} from "./image";

// 角色提取
export { importExtractedCharacters } from "./extraction";
export { startCharacterExtraction } from "./async-extraction";

// Prompt生成
export { 
  generateStylePrompt, 
  generateStylePromptFromDescription, 
  optimizeStylePrompt 
} from "./prompt-generation";
