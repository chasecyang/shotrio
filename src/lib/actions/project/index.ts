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

// 导出视频操作 (通过 actions/video 模块)
// 注意: 视频相关操作现在统一在 @/lib/actions/video 中
