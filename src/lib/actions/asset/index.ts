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
  getAssetsByIds,
  incrementAssetUsage,
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

// 派生操作
export {
  createDerivedAsset,
  copyAssetTags,
} from "./derivation";

// 上传操作
export {
  uploadAsset,
} from "./upload-asset";

