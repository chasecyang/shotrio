/**
 * Project Actions
 * 
 * 项目相关的所有 server actions
 */

// 导出项目基础操作
export {
  createProject,
  getUserProjects,
  getProjectDetail,
  updateProject,
  deleteProject,
} from "./base";

// 导出剧集操作
export {
  createEpisode,
  updateEpisode,
  deleteEpisode,
} from "./episode";

// 导出分镜操作
export {
  getEpisodeShots,
  createShot,
  updateShot,
  deleteShot,
  reorderShots,
  // 角色管理
  addCharacterToShot,
  removeCharacterFromShot,
  updateShotCharacter,
  // 对话管理
  addDialogueToShot,
  updateShotDialogue,
  deleteShotDialogue,
  reorderShotDialogues,
} from "./shot";
