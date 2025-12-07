/**
 * Character Actions
 * 角色相关的服务端操作
 */

// CRUD 操作
export { upsertCharacter, deleteCharacter } from "./crud";

// 图片管理
export {
  generateCharacterImages,
  generateImageForCharacterStyle,
  regenerateCharacterStyleImage,
  saveCharacterImage,
  deleteCharacterImage,
  setCharacterPrimaryImage,
} from "./image";

// 角色提取
export { extractCharactersFromScript, importExtractedCharacters } from "./extraction";
