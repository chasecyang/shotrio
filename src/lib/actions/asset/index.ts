/**
 * Asset系统的Server Actions入口
 */

// 类型定义
export type { CreateAssetFullInput, UpdateAssetFullInput } from "./types";

// 工具函数
export { resolveAssetVersionId, safeRevalidatePath } from "./utils";

// 基础 CRUD 操作
export {
  createAsset,
  createAssetInternal,
  updateAsset,
  deleteAsset,
  deleteAssets,
} from "./base-crud";

// 资产查询
export {
  getAsset,
  getAssetWithFullData,
  getAssetsByIds,
  incrementAssetUsage,
} from "./get-asset";

// 复杂查询操作
export {
  queryAssets,
  getProjectAssets,
  getAssetsByTag,
  getAssetDerivations,
} from "./queries";

// 视频资产
export {
  createVideoAsset,
  getVideoAssets,
  updateVideoAsset,
  deleteVideoAssets,
} from "./video-asset";

// 音频资产
export { createAudioAsset, uploadAudioAsset } from "./audio-asset";

// 版本管理
export {
  createAssetVersion,
  setActiveVersion,
  deleteAssetVersion,
} from "./version";

// 重新生成
export { regenerateVideoAsset } from "./regenerate";

// 标签管理
export {
  addAssetTag,
  addAssetTags,
  removeAssetTag,
  removeAssetTagsByValue,
  replaceAssetTags,
} from "./tags";

// 上传操作
export { uploadAsset } from "./upload-asset";

// 多媒体上传操作
export { uploadMediaAsset } from "./upload-media-asset";

// 文本上传操作
export { uploadTextAsset } from "./upload-text-asset";
