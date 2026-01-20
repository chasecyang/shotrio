"use server";

/**
 * 时间轴操作处理器
 *
 * 处理 add_clip, remove_clip, update_clip, add_audio_track
 */

import type { FunctionCall, FunctionExecutionResult } from "@/types/agent";
import { getAssetWithFullData } from "@/lib/actions/asset";
import {
  getOrCreateProjectTimeline,
  getProjectTimeline,
} from "@/lib/actions/timeline/timeline-actions";
import {
  addClipToTimeline,
  removeClip as removeClipAction,
  updateClip as updateClipAction,
  reorderClips,
} from "@/lib/actions/timeline/clip-actions";

/**
 * 统一的时间轴操作处理器
 */
export async function handleTimelineFunctions(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const { name } = functionCall;

  switch (name) {
    case "add_clip":
      return handleAddClip(functionCall, projectId);
    case "remove_clip":
      return handleRemoveClip(functionCall);
    case "update_clip":
      return handleUpdateClip(functionCall, projectId);
    case "add_audio_track":
      return handleAddAudioTrack(functionCall, projectId);
    default:
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `未知的时间轴函数: ${name}`,
      };
  }
}

/**
 * 添加片段到时间轴
 */
async function handleAddClip(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const { parameters } = functionCall;
  const assetId = parameters.assetId as string;
  const duration = parameters.duration as number | undefined;
  const insertAt = parameters.insertAt as string | undefined;
  const trimStart = parameters.trimStart as number | undefined;
  const trimEnd = parameters.trimEnd as number | undefined;
  const trackIndexParam = parameters.trackIndex as number | undefined;
  const startTimeParam = parameters.startTime as number | undefined;

  // 获取或创建时间轴
  const timelineResult = await getOrCreateProjectTimeline(projectId);
  if (!timelineResult.success || !timelineResult.timeline) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: timelineResult.error || "无法获取或创建时间轴",
    };
  }
  const timelineData = timelineResult.timeline;

  // 获取素材信息
  const assetResult = await getAssetWithFullData(assetId);
  if (!assetResult.success || !assetResult.asset) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: assetResult.error || `素材 ${assetId} 不存在`,
    };
  }
  const assetData = assetResult.asset;
  const isAudioAsset = assetData.assetType === "audio";

  // ========== 轨道选择逻辑 ==========
  let finalTrackIndex: number;

  if (trackIndexParam !== undefined) {
    const isTargetAudioTrack = trackIndexParam >= 100;

    if (isAudioAsset && !isTargetAudioTrack) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: "音频素材必须放在音频轨道（trackIndex >= 100）",
      };
    }

    if (!isAudioAsset && isTargetAudioTrack) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: "视频/图片素材不能放在音频轨道",
      };
    }

    finalTrackIndex = trackIndexParam;
  } else {
    finalTrackIndex = isAudioAsset ? 100 : 0;
  }

  // ========== 时长计算 ==========
  let clipDuration = duration;
  if (!clipDuration) {
    if (assetData.assetType === "video" && assetData.duration) {
      clipDuration = assetData.duration;
    } else if (assetData.assetType === "audio" && assetData.duration) {
      clipDuration = assetData.duration;
    } else if (assetData.assetType === "image") {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: "图片素材必须指定 duration 参数",
      };
    }
  }

  // ========== 位置计算 ==========
  let startTime: number | undefined = startTimeParam;
  let order: number | undefined;

  if (!isAudioAsset && startTime === undefined) {
    if (insertAt === "start") {
      startTime = 0;
      order = 0;
    } else if (insertAt && insertAt !== "end") {
      const targetClip = timelineData.clips.find((c) => c.id === insertAt);
      if (targetClip) {
        startTime = targetClip.startTime + targetClip.duration;
        order = targetClip.order + 1;
      }
    }
  }

  const addResult = await addClipToTimeline(timelineData.id, {
    assetId,
    trackIndex: finalTrackIndex,
    duration: clipDuration,
    startTime,
    order,
    trimStart: trimStart ?? 0,
    trimEnd,
  });

  if (addResult.success) {
    const trackTypeLabel = finalTrackIndex >= 100 ? "音频轨道" : "视频轨道";
    return {
      functionCallId: functionCall.id,
      success: true,
      data: {
        message: `已添加素材"${assetData.name}"到${trackTypeLabel}（轨道${finalTrackIndex}）`,
        trackIndex: finalTrackIndex,
        clipCount: addResult.timeline?.clips.length,
        timelineDuration: addResult.timeline?.duration,
      },
    };
  } else {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: addResult.error || "添加片段失败",
    };
  }
}

/**
 * 移除片段
 */
async function handleRemoveClip(
  functionCall: FunctionCall
): Promise<FunctionExecutionResult> {
  const clipId = functionCall.parameters.clipId as string;

  const removeResult = await removeClipAction(clipId);

  if (removeResult.success) {
    return {
      functionCallId: functionCall.id,
      success: true,
      data: {
        message: "已移除片段，后续片段已自动前移",
        clipCount: removeResult.timeline?.clips.length,
        timelineDuration: removeResult.timeline?.duration,
      },
    };
  } else {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: removeResult.error || "移除片段失败",
    };
  }
}

/**
 * 更新片段
 */
async function handleUpdateClip(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const { parameters } = functionCall;
  const clipId = parameters.clipId as string;
  const duration = parameters.duration as number | undefined;
  const trimStart = parameters.trimStart as number | undefined;
  const trimEnd = parameters.trimEnd as number | undefined;
  const moveToPosition = parameters.moveToPosition as number | undefined;
  const replaceWithAssetId = parameters.replaceWithAssetId as string | undefined;

  const timelineData = await getProjectTimeline(projectId);
  if (!timelineData) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: "时间轴不存在",
    };
  }

  const updates: string[] = [];

  // 处理素材替换
  if (replaceWithAssetId !== undefined) {
    const targetClip = timelineData.clips.find((c) => c.id === clipId);
    if (!targetClip) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `片段 ${clipId} 不存在`,
      };
    }

    const newAssetResult = await getAssetWithFullData(replaceWithAssetId);
    if (!newAssetResult.success || !newAssetResult.asset) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: newAssetResult.error || `素材 ${replaceWithAssetId} 不存在`,
      };
    }
    const newAsset = newAssetResult.asset;

    await removeClipAction(clipId);
    await addClipToTimeline(timelineData.id, {
      assetId: replaceWithAssetId,
      duration: duration ?? targetClip.duration,
      startTime: targetClip.startTime,
      order: targetClip.order,
      trimStart: trimStart ?? 0,
      trimEnd,
    });

    updates.push(`素材替换为"${newAsset.name}"`);

    return {
      functionCallId: functionCall.id,
      success: true,
      data: {
        message: `片段已更新：${updates.join("，")}`,
      },
    };
  }

  // 普通更新
  const updateInput: {
    duration?: number;
    trimStart?: number;
    trimEnd?: number;
  } = {};

  if (duration !== undefined) {
    updateInput.duration = duration;
    updates.push(`时长改为 ${duration}ms`);
  }
  if (trimStart !== undefined) {
    updateInput.trimStart = trimStart;
    updates.push(`入点改为 ${trimStart}ms`);
  }
  if (trimEnd !== undefined) {
    updateInput.trimEnd = trimEnd;
    updates.push(`出点改为 ${trimEnd}ms`);
  }

  if (Object.keys(updateInput).length > 0) {
    const updateResult = await updateClipAction(clipId, updateInput);
    if (!updateResult.success) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: updateResult.error || "更新片段失败",
      };
    }
  }

  // 处理移动位置
  if (moveToPosition !== undefined) {
    const currentClip = timelineData.clips.find((c) => c.id === clipId);
    if (!currentClip) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `片段 ${clipId} 不存在`,
      };
    }

    const otherClips = timelineData.clips
      .filter((c) => c.id !== clipId)
      .sort((a, b) => a.order - b.order);

    const newOrder: { clipId: string; order: number }[] = [];
    const insertIndex = Math.min(moveToPosition, otherClips.length);

    for (let i = 0; i < otherClips.length; i++) {
      if (i === insertIndex) {
        newOrder.push({ clipId, order: newOrder.length });
      }
      newOrder.push({ clipId: otherClips[i].id, order: newOrder.length });
    }

    if (insertIndex >= otherClips.length) {
      newOrder.push({ clipId, order: newOrder.length });
    }

    await reorderClips(timelineData.id, newOrder);
    updates.push(`移动到位置 ${moveToPosition}`);
  }

  return {
    functionCallId: functionCall.id,
    success: true,
    data: {
      message:
        updates.length > 0
          ? `片段已更新：${updates.join("，")}`
          : "没有需要更新的内容",
    },
  };
}

/**
 * 添加音频轨道
 */
async function handleAddAudioTrack(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const trackName = functionCall.parameters.name as string | undefined;

  const timelineResult = await getOrCreateProjectTimeline(projectId);
  if (!timelineResult.success || !timelineResult.timeline) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: timelineResult.error || "无法获取或创建时间轴",
    };
  }
  const timelineData = timelineResult.timeline;

  const { getTimelineTracks, addTrackToConfig } = await import("@/types/timeline");
  const { updateTimelineTracks } = await import(
    "@/lib/actions/timeline/timeline-actions"
  );

  const currentTracks = getTimelineTracks(timelineData.metadata);
  let newTracks = addTrackToConfig(currentTracks, "audio");

  if (trackName) {
    const lastTrack = newTracks[newTracks.length - 1];
    newTracks = newTracks.map((t) =>
      t.index === lastTrack.index ? { ...t, name: trackName } : t
    );
  }

  const updateResult = await updateTimelineTracks(timelineData.id, newTracks);

  if (updateResult.success) {
    const newTrack = newTracks.find(
      (t) =>
        t.type === "audio" && !currentTracks.some((ct) => ct.index === t.index)
    );
    return {
      functionCallId: functionCall.id,
      success: true,
      data: {
        message: `已添加音频轨道"${newTrack?.name}"（索引 ${newTrack?.index}）`,
        trackIndex: newTrack?.index,
        totalTracks: newTracks.length,
      },
    };
  } else {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: updateResult.error || "添加音频轨道失败",
    };
  }
}
