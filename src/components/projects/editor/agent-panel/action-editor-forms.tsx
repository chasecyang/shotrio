"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryAssets } from "@/lib/actions/asset";
import { AssetWithFullData } from "@/types/asset";
import { isAssetReady } from "@/lib/utils/asset-status";
import { cn } from "@/lib/utils";
import { getAssetsByIds } from "@/lib/actions/asset";
import { useEditor } from "../editor-context";
import { parsePromptReferences } from "@/lib/utils/agent-params-formatter";

// Prompt高亮组件
export function PromptWithHighlights({ 
  prompt
}: { 
  prompt: string;
}) {
  const parts = parsePromptReferences(prompt);
  
  return (
    <div className="whitespace-pre-wrap text-xs leading-relaxed">
      {parts.map((part, i) => 
        part.isReference ? (
          <span key={i} className="font-medium text-primary bg-primary/10 px-1 rounded">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </div>
  );
}

// 素材预览组件（支持自动刷新）
export function AssetPreview({ assetIds }: { assetIds: string[] }) {
  const [assets, setAssets] = useState<Array<{
    id: string;
    name: string;
    displayUrl: string | null;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 使用 ref 跟踪当前请求的 assetIds，防止竞态条件
  const currentRequestRef = useRef<string>("");
  // 获取 Editor Context 中的 jobs 状态
  const { jobs } = useEditor();

  // 加载素材数据
  const loadAssets = async (requestId: string) => {
    if (assetIds.length === 0) {
      if (currentRequestRef.current === requestId) {
        setIsLoading(false);
      }
      return;
    }

    try {
      const result = await getAssetsByIds(assetIds);
      // 检查请求是否仍然有效（assetIds 没有变化）
      if (currentRequestRef.current === requestId) {
        if (result.success && result.assets) {
          setAssets(result.assets);
        }
        setIsLoading(false);
      }
    } catch (error) {
      // 只有在当前请求仍然有效时才更新状态
      if (currentRequestRef.current === requestId) {
        console.error("加载素材失败:", error);
        setIsLoading(false);
      }
    }
  };

  // 初始加载
  useEffect(() => {
    const requestId = JSON.stringify(assetIds.sort());
    currentRequestRef.current = requestId;

    // 立即重置状态，避免显示旧的图片
    setAssets([]);
    setIsLoading(true);

    loadAssets(requestId);

    // 清理函数：标记请求已取消
    return () => {
      currentRequestRef.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetIds]); // loadAssets 故意省略，使用 requestId 控制

  // 监听 jobs 变化，自动刷新相关素材
  useEffect(() => {
    // 检查是否有相关的 asset_image 任务完成
    const completedAssetJobs = jobs.filter(
      (job) =>
        job.type === "asset_image" &&
        job.status === "completed" &&
        job.inputData
    );

    if (completedAssetJobs.length === 0) return;

    // 检查是否有我们关心的 assetId（使用外键）
    const shouldRefresh = completedAssetJobs.some((job) => {
      return job.assetId ? assetIds.includes(job.assetId) : false;
    });

    if (shouldRefresh) {
      // 重新加载素材数据
      const requestId = currentRequestRef.current;
      if (requestId) {
        loadAssets(requestId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, assetIds]); // loadAssets 故意省略，使用 requestId 控制

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>加载素材...</span>
      </div>
    );
  }

  if (assets.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="relative group rounded-md overflow-hidden border border-border/50 bg-background/50"
        >
          <div className="relative w-16 h-16">
            {asset.displayUrl ? (
              <Image
                src={asset.displayUrl}
                alt={asset.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
          <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-[10px] text-white truncate">{asset.name}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// 图片生成表单
interface ImageGenerationFormProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
}

export function ImageGenerationForm({ params, onChange }: ImageGenerationFormProps) {
  const { state } = useEditor();
  const projectId = state.project?.id || "";

  // 解析生成素材的assets数组
  const generationAssets = useMemo(() => {
    try {
      const assetsArg = params.assets;
      let assetsArray: Array<Record<string, unknown>>;

      // 兼容数组和JSON字符串
      if (Array.isArray(assetsArg)) {
        assetsArray = assetsArg;
      } else if (typeof assetsArg === "string") {
        assetsArray = JSON.parse(assetsArg);
      } else {
        return null;
      }

      if (!Array.isArray(assetsArray)) return null;

      return assetsArray.map((asset: Record<string, unknown>) => {
        const prompt = asset.prompt || "-";
        const name = asset.name || "未命名";
        const tags = Array.isArray(asset.tags)
          ? asset.tags.join(", ")
          : (typeof asset.tags === "string" ? asset.tags : "-");

        // 提取sourceAssetIds（用于图生图）
        let sourceIds: string[] = [];
        if (Array.isArray(asset.sourceAssetIds)) {
          sourceIds = asset.sourceAssetIds as string[];
        } else if (typeof asset.sourceAssetIds === "string") {
          try {
            const parsed = JSON.parse(asset.sourceAssetIds);
            if (Array.isArray(parsed)) {
              sourceIds = parsed;
            }
          } catch {
            // 不是JSON，忽略
          }
        }

        return {
          name: name as string,
          prompt: prompt as string,
          tags: tags as string,
          sourceAssetIds: sourceIds,
        };
      });
    } catch (error) {
      console.error("解析assets数组失败:", error);
      return null;
    }
  }, [params]);

  if (!generationAssets || generationAssets.length === 0) {
    return <p className="text-muted-foreground text-sm">无法解析图片生成参数</p>;
  }

  return (
    <div className="space-y-6">
      {generationAssets.map((asset, index) => (
        <div key={index} className="rounded-md border p-4 space-y-4">
          <div className="font-medium text-sm flex items-center gap-2">
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">#{index + 1}</span>
            {asset.name}
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>名称</Label>
              <Input
                value={asset.name}
                onChange={(e) => {
                  const newAssets = [...generationAssets];
                  newAssets[index] = { ...newAssets[index], name: e.target.value };
                  onChange({ ...params, assets: newAssets });
                }}
                placeholder="资产名称"
              />
            </div>
            <div className="grid gap-2">
              <Label>提示词 *</Label>
              <Textarea
                value={asset.prompt}
                onChange={(e) => {
                  const newAssets = [...generationAssets];
                  newAssets[index] = { ...newAssets[index], prompt: e.target.value };
                  onChange({ ...params, assets: newAssets });
                }}
                className="min-h-[100px]"
                placeholder="描述你想生成的图片"
              />
            </div>
            <div className="grid gap-2">
              <Label>标签</Label>
              <Input
                value={asset.tags}
                onChange={(e) => {
                  const newAssets = [...generationAssets];
                  newAssets[index] = { ...newAssets[index], tags: e.target.value };
                  onChange({ ...params, assets: newAssets });
                }}
                placeholder="用逗号分隔，如: 角色, 主角"
              />
            </div>
            <MultiAssetSelector
              projectId={projectId}
              selectedAssetIds={asset.sourceAssetIds}
              onSelect={(assetIds) => {
                const newAssets = [...generationAssets];
                newAssets[index] = { ...newAssets[index], sourceAssetIds: assetIds };
                onChange({ ...params, assets: newAssets });
              }}
              label="参考图"
              assetType="image"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// 单选素材选择器组件
interface SingleAssetSelectorProps {
  projectId: string;
  selectedAssetId: string | undefined;
  onSelect: (assetId: string | undefined) => void;
  label: string;
  allowClear?: boolean;
  assetType?: "image" | "video";
}

function SingleAssetSelector({
  projectId,
  selectedAssetId,
  onSelect,
  label,
  allowClear = false,
  assetType = "image",
}: SingleAssetSelectorProps) {
  const [assets, setAssets] = useState<AssetWithFullData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{
    id: string;
    name: string;
    displayUrl: string | null;
  } | null>(null);

  // 加载选中的素材信息
  useEffect(() => {
    if (!selectedAssetId) {
      setSelectedAsset(null);
      return;
    }

    getAssetsByIds([selectedAssetId]).then((result) => {
      if (result.success && result.assets && result.assets.length > 0) {
        setSelectedAsset(result.assets[0]);
      }
    });
  }, [selectedAssetId]);

  // 打开选择器时加载素材列表
  useEffect(() => {
    if (!isOpen || assets.length > 0) return;

    async function loadAssets() {
      setIsLoading(true);
      try {
        const result = await queryAssets({
          projectId,
          assetType,
          limit: 50,
        });
        setAssets(result.assets);
      } catch (error) {
        console.error("加载素材失败:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAssets();
  }, [isOpen, projectId, assetType, assets.length]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "relative w-20 h-20 rounded-lg border-2 border-dashed",
                "flex items-center justify-center overflow-hidden",
                "hover:border-primary/50 transition-colors",
                selectedAsset ? "border-solid border-border" : "border-muted-foreground/30"
              )}
            >
              {selectedAsset?.displayUrl ? (
                <Image
                  src={selectedAsset.displayUrl}
                  alt={selectedAsset.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <ScrollArea className="h-[280px]">
              {isLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : assets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  暂无可用素材
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {assets.filter(isAssetReady).map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        onSelect(asset.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden",
                        "border-2 transition-all",
                        selectedAssetId === asset.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-transparent hover:border-muted-foreground/30"
                      )}
                    >
                      {asset.displayUrl ? (
                        <Image
                          src={asset.displayUrl}
                          alt={asset.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-muted" />
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                        <p className="text-[10px] text-white truncate">{asset.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
        {selectedAsset && (
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{selectedAsset.name}</p>
          </div>
        )}
        {allowClear && selectedAssetId && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onSelect(undefined)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// 多选素材选择器组件
interface MultiAssetSelectorProps {
  projectId: string;
  selectedAssetIds: string[];
  onSelect: (assetIds: string[]) => void;
  label: string;
  assetType?: "image" | "video";
}

function MultiAssetSelector({
  projectId,
  selectedAssetIds,
  onSelect,
  label,
  assetType = "image",
}: MultiAssetSelectorProps) {
  const [assets, setAssets] = useState<AssetWithFullData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<Array<{
    id: string;
    name: string;
    displayUrl: string | null;
  }>>([]);

  // 加载选中的素材信息
  useEffect(() => {
    if (selectedAssetIds.length === 0) {
      setSelectedAssets([]);
      return;
    }

    getAssetsByIds(selectedAssetIds).then((result) => {
      if (result.success && result.assets) {
        setSelectedAssets(result.assets);
      }
    });
  }, [selectedAssetIds]);

  // 打开选择器时加载素材列表
  useEffect(() => {
    if (!isOpen || assets.length > 0) return;

    async function loadAssets() {
      setIsLoading(true);
      try {
        const result = await queryAssets({
          projectId,
          assetType,
          limit: 50,
        });
        setAssets(result.assets);
      } catch (error) {
        console.error("加载素材失败:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAssets();
  }, [isOpen, projectId, assetType, assets.length]);

  const handleToggleAsset = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      onSelect(selectedAssetIds.filter(id => id !== assetId));
    } else {
      onSelect([...selectedAssetIds, assetId]);
    }
  };

  const handleRemoveAsset = (assetId: string) => {
    onSelect(selectedAssetIds.filter(id => id !== assetId));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {selectedAssets.map((asset) => (
          <div
            key={asset.id}
            className="relative group rounded-md overflow-hidden border border-border/50 bg-background/50"
          >
            <div className="relative w-16 h-16">
              {asset.displayUrl ? (
                <Image
                  src={asset.displayUrl}
                  alt={asset.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleRemoveAsset(asset.id)}
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3 text-destructive-foreground" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-[10px] text-white truncate">{asset.name}</p>
            </div>
          </div>
        ))}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "relative w-16 h-16 rounded-md border-2 border-dashed",
                "flex items-center justify-center",
                "hover:border-primary/50 transition-colors",
                "border-muted-foreground/30"
              )}
            >
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <ScrollArea className="h-[280px]">
              {isLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : assets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  暂无可用素材
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {assets.filter(isAssetReady).map((asset) => {
                    const isSelected = selectedAssetIds.includes(asset.id);
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleToggleAsset(asset.id)}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden",
                          "border-2 transition-all",
                          isSelected
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-transparent hover:border-muted-foreground/30"
                        )}
                      >
                        {asset.displayUrl ? (
                          <Image
                            src={asset.displayUrl}
                            alt={asset.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-muted" />
                        )}
                        {isSelected && (
                          <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-primary-foreground text-xs">✓</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                          <p className="text-[10px] text-white truncate">{asset.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// 视频生成表单
interface VideoGenerationFormProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
}

export function VideoGenerationForm({ params, onChange }: VideoGenerationFormProps) {
  const { state } = useEditor();
  const projectId = state.project?.id || "";

  return (
    <div className="space-y-4">
      {/* 提示词 */}
      <div className="grid gap-2">
        <Label>提示词 *</Label>
        <Textarea
          value={(params.prompt as string) || ""}
          onChange={(e) => onChange({ ...params, prompt: e.target.value })}
          className="min-h-[100px]"
          placeholder="描述视频内容和镜头运动"
        />
      </div>

      {/* 标题 */}
      <div className="grid gap-2">
        <Label>标题</Label>
        <Input
          value={(params.title as string) || ""}
          onChange={(e) => onChange({ ...params, title: e.target.value })}
          placeholder="视频标题"
        />
      </div>

      {/* 时长和宽高比 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>时长</Label>
          <Select
            value={(params.duration as string) || "4"}
            onValueChange={(value) => onChange({ ...params, duration: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4 秒</SelectItem>
              <SelectItem value="8">8 秒</SelectItem>
              <SelectItem value="12">12 秒</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>宽高比</Label>
          <Select
            value={(params.aspect_ratio as string) || "16:9"}
            onValueChange={(value) => onChange({ ...params, aspect_ratio: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16:9">16:9 (宽屏)</SelectItem>
              <SelectItem value="9:16">9:16 (竖屏)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 起始帧和结束帧 */}
      <div className="grid grid-cols-2 gap-4">
        <SingleAssetSelector
          projectId={projectId}
          selectedAssetId={params.start_image_url as string | undefined}
          onSelect={(assetId) => onChange({ ...params, start_image_url: assetId })}
          label="起始帧 *"
          assetType="image"
        />
        <SingleAssetSelector
          projectId={projectId}
          selectedAssetId={params.end_image_url as string | undefined}
          onSelect={(assetId) => onChange({ ...params, end_image_url: assetId })}
          label="结束帧（可选）"
          allowClear
          assetType="image"
        />
      </div>
    </div>
  );
}

// 文本资产表单
interface TextAssetFormProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
}

export function TextAssetForm({ params, onChange }: TextAssetFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>名称 *</Label>
        <Input
          value={params.name as string || ""}
          onChange={(e) => onChange({ ...params, name: e.target.value })}
          placeholder="文本资产名称，如'主角小传'、'第一幕剧本'"
        />
      </div>
      
      <div className="space-y-2">
        <Label>内容 *</Label>
        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit">编辑</TabsTrigger>
            <TabsTrigger value="preview">预览</TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="mt-2">
            <Textarea
              value={params.content as string || ""}
              onChange={(e) => onChange({ ...params, content: e.target.value })}
              className="min-h-[300px] font-mono text-sm"
              placeholder="支持 Markdown 语法..."
            />
          </TabsContent>
          <TabsContent value="preview" className="mt-2">
            <div className="min-h-[300px] max-h-[400px] border rounded-md p-4 bg-muted/30 overflow-auto">
              <MarkdownRenderer content={params.content as string || "*暂无内容*"} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      <div className="grid gap-2">
        <Label>标签</Label>
        <Input
          value={
            Array.isArray(params.tags) 
              ? params.tags.join(", ") 
              : (params.tags as string || "")
          }
          onChange={(e) => {
            const tagsStr = e.target.value;
            const tagsArray = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
            onChange({ ...params, tags: tagsArray });
          }}
          placeholder="用逗号分隔，如: 角色小传, 主角"
        />
      </div>
    </div>
  );
}






