/**
 * Asset系统的Server Actions入口
 */

// CRUD操作
export {
  createAsset,
  updateAsset,
  deleteAsset,
  getAsset,
  incrementAssetUsage,
} from "./crud";

// 查询操作
export {
  queryAssets,
  getProjectAssets,
  getAssetsByTagType,
  getAssetDerivations,
} from "./queries";

// 标签管理
export {
  addAssetTag,
  addAssetTags,
  removeAssetTag,
  removeAssetTagsByType,
  replaceAssetTags,
} from "./tags";

// 派生操作
export {
  createDerivedAsset,
  copyAssetTags,
} from "./derivation";

// 上传操作
export {
  uploadAsset,
} from "./upload-asset";

