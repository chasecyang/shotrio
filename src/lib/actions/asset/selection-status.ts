"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";
import { asset } from "@/lib/db/schemas/project";
import { eq, and, inArray } from "drizzle-orm";
import type { AssetSelectionStatus } from "@/types/asset";
import { safeRevalidatePath } from "./utils";

/**
 * Update selection status for a single asset
 */
export async function updateAssetSelectionStatus(
  assetId: string,
  status: AssetSelectionStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify asset belongs to user
    const existingAsset = await db.query.asset.findFirst({
      where: and(
        eq(asset.id, assetId),
        eq(asset.userId, session.user.id)
      ),
    });

    if (!existingAsset) {
      return { success: false, error: "Asset not found or access denied" };
    }

    // Update selection status
    await db
      .update(asset)
      .set({ selectionStatus: status })
      .where(eq(asset.id, assetId));

    // Revalidate the project page
    safeRevalidatePath(`/projects/${existingAsset.projectId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating asset selection status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Batch update selection status for multiple assets
 */
export async function batchUpdateSelectionStatus(
  assetIds: string[],
  status: AssetSelectionStatus
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (assetIds.length === 0) {
      return { success: false, error: "No assets provided" };
    }

    // Verify all assets belong to user
    const existingAssets = await db.query.asset.findMany({
      where: and(
        inArray(asset.id, assetIds),
        eq(asset.userId, session.user.id)
      ),
    });

    if (existingAssets.length === 0) {
      return { success: false, error: "No assets found or access denied" };
    }

    // Update selection status for all verified assets
    const verifiedAssetIds = existingAssets.map((a) => a.id);
    await db
      .update(asset)
      .set({ selectionStatus: status })
      .where(inArray(asset.id, verifiedAssetIds));

    // Revalidate project pages (get unique project IDs)
    const projectIds = [...new Set(existingAssets.map((a) => a.projectId))];
    projectIds.forEach((projectId) => {
      safeRevalidatePath(`/projects/${projectId}`);
    });

    return { success: true, updatedCount: verifiedAssetIds.length };
  } catch (error) {
    console.error("Error batch updating asset selection status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
