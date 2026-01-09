/**
 * Asset系统的Server Actions入口
 */

// CRUD操作
export {
  createAsset,
  updateAsset,
  deleteAsset,
  deleteAssets,
  getAsset,
  getAssetWithFullData,
  getAssetsByIds,
  incrementAssetUsage,
  // 视频资产
  createVideoAsset,
  getVideoAssets,
  updateVideoAsset,
  deleteVideoAssets,
} from "./crud";

// 查询操作
export {
  queryAssets,
  getProjectAssets,
  getAssetsByTag,
  getAssetDerivations,
} from "./queries";

// 标签管理
export {
  addAssetTag,
  addAssetTags,
  removeAssetTag,
  removeAssetTagsByValue,
  replaceAssetTags,
} from "./tags";

// 上传操作
export {
  uploadAsset,
} from "./upload-asset";

// 多媒体上传操作
export {
  uploadMediaAsset,
} from "./upload-media-asset";

// 文本上传操作
export {
  uploadTextAsset,
} from "./upload-text-asset";

