"use server";

import type {
  AssetTypeEnum,
  AssetSourceType,
  AssetMeta,
  CreateImageDataInput,
  CreateVideoDataInput,
  CreateTextDataInput,
  CreateAudioDataInput,
  UpdateImageDataInput,
  UpdateVideoDataInput,
  UpdateTextDataInput,
  UpdateAudioDataInput,
} from "@/types/asset";

/**
 * 创建资产的输入类型（完整版，包含所有扩展数据）
 */
export interface CreateAssetFullInput {
  projectId: string;
  name: string;
  assetType: AssetTypeEnum;
  sourceType: AssetSourceType;
  meta?: AssetMeta;
  tags?: string[];
  order?: number;

  // 类型数据（根据 assetType 选择，包含生成信息）
  imageData?: Omit<CreateImageDataInput, "assetId">;
  videoData?: Omit<CreateVideoDataInput, "assetId">;
  textData?: Omit<CreateTextDataInput, "assetId">;
  audioData?: Omit<CreateAudioDataInput, "assetId">;
}

/**
 * 更新资产的输入类型（完整版）
 */
export interface UpdateAssetFullInput {
  name?: string;
  meta?: AssetMeta;
  order?: number;

  // 类型数据更新（根据 assetType，包含生成信息）
  imageData?: UpdateImageDataInput;
  videoData?: UpdateVideoDataInput;
  textData?: UpdateTextDataInput;
  audioData?: UpdateAudioDataInput;
}
