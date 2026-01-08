// Fal.ai Vision 图像分析服务

import { fal } from "@fal-ai/client";
import { getImageUrl } from "@/lib/storage/r2.service";
import { configureFal } from "./config";
import type { VisionInput, VisionOutput } from "./types";

/**
 * Use Vision model to analyze images
 */
export async function generateVisionDescription(
  input: VisionInput
): Promise<string> {
  configureFal();

  const prompt =
    input.prompt ||
    "Describe this image in detail, focusing on the visual elements, characters, and action.";

  let imageUrl = input.imageUrl;
  if (!imageUrl.startsWith("http")) {
    const publicUrl = getImageUrl(imageUrl);
    if (publicUrl) {
      imageUrl = publicUrl;
    }
  }

  try {
    const result = await fal.subscribe("openrouter/router/vision", {
      input: {
        image_urls: [imageUrl],
        prompt: prompt,
        model: "openai/gpt-4o-mini",
      },
      logs: true,
    });

    const data = result.data as VisionOutput;

    if ("output" in data && typeof data.output === "string") {
      return data.output;
    }

    if (
      data.choices &&
      data.choices.length > 0 &&
      data.choices[0].message?.content
    ) {
      return data.choices[0].message.content;
    }

    if (data.message) return data.message;
    if (data.text) return data.text;

    console.error("Unexpected vision model response:", data);
    return "Failed to analyze image: Unexpected response format";
  } catch (error) {
    console.error("Vision API error:", error);
    throw new Error("Failed to analyze image");
  }
}
