"use server";

/**
 * 剪辑操作处理器
 *
 * 处理 create_cut, add_clip, remove_clip, update_clip, add_audio_track
 */

import type { FunctionCall, FunctionExecutionResult } from "@/types/agent";
import { getAssetWithFullData } from "@/lib/actions/asset";
import {
  getProjectCuts,
  createCut,
  getCut,
  deleteCut,
} from "@/lib/actions/cut";
import {
  addCutClip,
  removeCutClip,
  updateCutClip,
  reorderCutClips,
} from "@/lib/actions/cut";
import { getCutTracks, addTrackToConfig, type TrackConfig } from "@/types/cut";
import { updateCutTracks } from "@/lib/actions/cut";

/**
 * 统一的剪辑操作处理器
 */
export async function handleCutFunctions(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const { name } = functionCall;

  switch (name) {
    case "create_cut":
      return handleCreateCut(functionCall, projectId);
    case "delete_cut":
      return handleDeleteCut(functionCall);
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
        error: `Unknown cut function: ${name}`,
      };
  }
}

/**
 * Create a new cut
 */
async function handleCreateCut(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const { parameters } = functionCall;
  const title = parameters.title as string | undefined;
  const description = parameters.description as string | undefined;
  const resolution = parameters.resolution as string | undefined;
  const fps = parameters.fps as number | undefined;

  const result = await createCut({
    projectId,
    title,
    description,
    resolution,
    fps,
  });

  if (result.success && result.cut) {
    return {
      functionCallId: functionCall.id,
      success: true,
      data: {
        cut: {
          id: result.cut.id,
          title: result.cut.title,
          resolution: result.cut.resolution,
          fps: result.cut.fps,
        },
      },
    };
  } else {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: result.error || "Failed to create cut",
    };
  }
}

/**
 * Delete a cut
 */
async function handleDeleteCut(
  functionCall: FunctionCall
): Promise<FunctionExecutionResult> {
  const cutId = functionCall.parameters.cutId as string;

  const result = await deleteCut(cutId);

  if (result.success) {
    return {
      functionCallId: functionCall.id,
      success: true,
      data: {
        cutId,
      },
    };
  } else {
    return {
      functionCallId: functionCall.id,
      success: false,
      error: result.error || "Failed to delete cut",
    };
  }
}

/**
 * Add clip to cut
 */
async function handleAddClip(
  functionCall: FunctionCall,
  projectId: string
): Promise<FunctionExecutionResult> {
  const { parameters } = functionCall;
  const cutIdParam = parameters.cutId as string | undefined;
  const assetId = parameters.assetId as string;
  const duration = parameters.duration as number | undefined;
  const insertAt = parameters.insertAt as string | undefined;
  const trimStart = parameters.trimStart as number | undefined;
  const trimEnd = parameters.trimEnd as number | undefined;
  const trackIndexParam = parameters.trackIndex as number | undefined;
  const startTimeParam = parameters.startTime as number | undefined;

  // Get cut by cutId or get/create default cut
  let cutData;
  if (cutIdParam) {
    cutData = await getCut(cutIdParam);
    if (!cutData) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `Cut ${cutIdParam} not found`,
      };
    }
  } else {
    const cuts = await getProjectCuts(projectId);
    if (cuts.length > 0) {
      cutData = await getCut(cuts[0].id);
    }
    if (!cutData) {
      const result = await createCut({ projectId });
      if (!result.success || !result.cut) {
        return {
          functionCallId: functionCall.id,
          success: false,
          error: result.error || "Failed to get or create cut",
        };
      }
      cutData = result.cut;
    }
  }

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
      const targetClip = cutData.clips.find((c) => c.id === insertAt);
      if (targetClip) {
        startTime = targetClip.startTime + targetClip.duration;
        order = targetClip.order + 1;
      }
    }
  }

  const addResult = await addCutClip(cutData.id, {
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
        clipCount: addResult.cut?.clips.length,
        cutDuration: addResult.cut?.duration,
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

  const removeResult = await removeCutClip(clipId);

  if (removeResult.success) {
    return {
      functionCallId: functionCall.id,
      success: true,
      data: {
        message: "Clip removed, subsequent clips shifted forward",
        clipCount: removeResult.cut?.clips.length,
        cutDuration: removeResult.cut?.duration,
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
  const cutIdParam = parameters.cutId as string | undefined;
  const clipId = parameters.clipId as string;
  const duration = parameters.duration as number | undefined;
  const trimStart = parameters.trimStart as number | undefined;
  const trimEnd = parameters.trimEnd as number | undefined;
  const moveToPosition = parameters.moveToPosition as number | undefined;
  const replaceWithAssetId = parameters.replaceWithAssetId as string | undefined;

  // Get cut by cutId or get default cut
  let cutData;
  if (cutIdParam) {
    cutData = await getCut(cutIdParam);
    if (!cutData) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `Cut ${cutIdParam} not found`,
      };
    }
  } else {
    const cuts = await getProjectCuts(projectId);
    if (cuts.length > 0) {
      cutData = await getCut(cuts[0].id);
    }
    if (!cutData) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: "Cut does not exist",
      };
    }
  }

  const updates: string[] = [];

  // Handle asset replacement
  if (replaceWithAssetId !== undefined) {
    const targetClip = cutData.clips.find((c) => c.id === clipId);
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

    await removeCutClip(clipId);
    await addCutClip(cutData.id, {
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
    const updateResult = await updateCutClip(clipId, updateInput);
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
    const currentClip = cutData.clips.find((c) => c.id === clipId);
    if (!currentClip) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `Clip ${clipId} not found`,
      };
    }

    const otherClips = cutData.clips
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

    await reorderCutClips(cutData.id, newOrder);
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
  const { parameters } = functionCall;
  const cutIdParam = parameters.cutId as string | undefined;
  const trackName = parameters.name as string | undefined;

  // Get cut by cutId or get/create default cut
  let cutData;
  if (cutIdParam) {
    cutData = await getCut(cutIdParam);
    if (!cutData) {
      return {
        functionCallId: functionCall.id,
        success: false,
        error: `Cut ${cutIdParam} not found`,
      };
    }
  } else {
    const cuts = await getProjectCuts(projectId);
    if (cuts.length > 0) {
      cutData = await getCut(cuts[0].id);
    }
    if (!cutData) {
      const result = await createCut({ projectId });
      if (!result.success || !result.cut) {
        return {
          functionCallId: functionCall.id,
          success: false,
          error: result.error || "Failed to get or create cut",
        };
      }
      cutData = result.cut;
    }
  }

  const currentTracks = getCutTracks(cutData.metadata);
  let newTracks = addTrackToConfig(currentTracks, "audio");

  if (trackName) {
    const lastTrack = newTracks[newTracks.length - 1];
    newTracks = newTracks.map((t: TrackConfig) =>
      t.index === lastTrack.index ? { ...t, name: trackName } : t
    );
  }

  const updateResult = await updateCutTracks(cutData.id, newTracks);

  if (updateResult.success) {
    const newTrack = newTracks.find(
      (t: TrackConfig) =>
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
