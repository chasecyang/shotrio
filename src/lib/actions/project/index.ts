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

// 注意: 视频相关操作现在统一在 @/lib/actions/asset 中
// 使用 createVideoAsset, getVideoAssets, updateVideoAsset, deleteVideoAssets
