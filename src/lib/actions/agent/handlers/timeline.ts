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
} from "@/lib/actions/cut";
import {
  addClipToTimeline,
  removeClip as removeClipAction,
  updateClip as updateClipAction,
  reorderClips,
} from "@/lib/actions/cut";

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
        error: `Unknown timeline function: ${name}`,
      };
  }
}

/**
 * Add clip to timeline
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

  // Get or create timeline
  const timelineResult = await getOrCreateProjectTimeline(projectId);
  if (!timelineResult.success || !timelineResult.timeline) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: timelineResult.error || "Failed to get or create timeline",
    };
  }
  const timelineData = timelineResult.timeline;

  // Get asset info
  const assetResult = await getAssetWithFullData(assetId);
  if (!assetResult.success || !assetResult.asset) {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: assetResult.error || `Asset ${assetId} not found`,
    };
  }
  const assetData = assetResult.asset;
  const isAudioAsset = assetData.assetType === "audio";

  // ========== Track selection logic ==========
  let finalTrackIndex: number;

  if (trackIndexParam !== undefined) {
    const isTargetAudioTrack = trackIndexParam >= 100;

    if (isAudioAsset && !isTargetAudioTrack) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: "Audio assets must be placed on audio tracks (trackIndex >= 100)",
      };
    }

    if (!isAudioAsset && isTargetAudioTrack) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: "Video/image assets cannot be placed on audio tracks",
      };
    }

    finalTrackIndex = trackIndexParam;
  } else {
    finalTrackIndex = isAudioAsset ? 100 : 0;
  }

  // ========== Duration calculation ==========
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
        error: "Image assets require a duration parameter",
      };
    }
  }

  // ========== Position calculation ==========
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
    const trackTypeLabel = finalTrackIndex >= 100 ? "audio track" : "video track";
    return {
      functionCallId: functionCall.id,
      success: true,
      data: {
        message: `Added asset "${assetData.name}" to ${trackTypeLabel} (track ${finalTrackIndex})`,
        trackIndex: finalTrackIndex,
        clipCount: addResult.timeline?.clips.length,
        timelineDuration: addResult.timeline?.duration,
      },
    };
  } else {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: addResult.error || "Failed to add clip",
    };
  }
}

/**
 * Remove clip
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
        message: "Clip removed, subsequent clips shifted forward",
        clipCount: removeResult.timeline?.clips.length,
        timelineDuration: removeResult.timeline?.duration,
      },
    };
  } else {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: removeResult.error || "Failed to remove clip",
    };
  }
}

/**
 * Update clip
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
      error: "Timeline does not exist",
    };
  }

  const updates: string[] = [];

  // Handle asset replacement
  if (replaceWithAssetId !== undefined) {
    const targetClip = timelineData.clips.find((c) => c.id === clipId);
    if (!targetClip) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `Clip ${clipId} not found`,
      };
    }

    const newAssetResult = await getAssetWithFullData(replaceWithAssetId);
    if (!newAssetResult.success || !newAssetResult.asset) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: newAssetResult.error || `Asset ${replaceWithAssetId} not found`,
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

    updates.push(`Asset replaced with "${newAsset.name}"`);

    return {
      functionCallId: functionCall.id,
      success: true,
      data: {
        message: `Clip updated: ${updates.join(", ")}`,
      },
    };
  }

  // Normal update
  const updateInput: {
    duration?: number;
    trimStart?: number;
    trimEnd?: number;
  } = {};

  if (duration !== undefined) {
    updateInput.duration = duration;
    updates.push(`Duration set to ${duration}ms`);
  }
  if (trimStart !== undefined) {
    updateInput.trimStart = trimStart;
    updates.push(`Trim start set to ${trimStart}ms`);
  }
  if (trimEnd !== undefined) {
    updateInput.trimEnd = trimEnd;
    updates.push(`Trim end set to ${trimEnd}ms`);
  }

  if (Object.keys(updateInput).length > 0) {
    const updateResult = await updateClipAction(clipId, updateInput);
    if (!updateResult.success) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: updateResult.error || "Failed to update clip",
      };
    }
  }

  // Handle position move
  if (moveToPosition !== undefined) {
    const currentClip = timelineData.clips.find((c) => c.id === clipId);
    if (!currentClip) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `Clip ${clipId} not found`,
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
    updates.push(`Moved to position ${moveToPosition}`);
  }

  return {
    functionCallId: functionCall.id,
    success: true,
    data: {
      message:
        updates.length > 0
          ? `Clip updated: ${updates.join(", ")}`
          : "No updates needed",
    },
  };
}

/**
 * Add audio track
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
      error: timelineResult.error || "Failed to get or create timeline",
    };
  }
  const timelineData = timelineResult.timeline;

  const { getTimelineTracks, addTrackToConfig } = await import("@/types/timeline");
  const { updateTimelineTracks } = await import(
    "@/lib/actions/cut"
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
        message: `Added audio track "${newTrack?.name}" (index ${newTrack?.index})`,
        trackIndex: newTrack?.index,
        totalTracks: newTracks.length,
      },
    };
  } else {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: updateResult.error || "Failed to add audio track",
    };
  }
}
