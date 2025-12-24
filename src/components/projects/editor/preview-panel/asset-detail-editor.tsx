"use client";

import { useState, useEffect, useCallback } from "react";
import { AssetWithTags, parseAssetMeta } from "@/types/asset";
import { getAsset } from "@/lib/actions/asset";
import { updateAsset, deleteAsset, addAssetTag, removeAssetTag } from "@/lib/actions/asset";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Tag,
  Calendar,
  Hash,
  Link2,
  Trash2,
  Download,
  Loader2,
  Info,
  Sparkles,
  X,
  Plus,
} from "lucide-react";
import {
  EditableInput,
  SaveStatus,
} from "@/components/ui/inline-editable-field";
import Image from "next/image";
import { useEditor } from "../editor-context";
import { AssetDeriveDialog } from "../resource-panel/asset-derive-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AssetDetailEditorProps {
  assetId: string;
}

export function AssetDetailEditor({ assetId }: AssetDetailEditorProps) {
  const { selectResource } = useEditor();
  const [asset, setAsset] = useState<AssetWithTags | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [deriveDialogOpen, setDeriveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 标签相关状态
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  const [removingTagIds, setRemovingTagIds] = useState<Set<string>>(new Set());

  // 表单数据
  const [formData, setFormData] = useState({
    name: "",
  });

  // 刷新素材数据（统一的刷新函数）
  const refreshAsset = useCallback(async () => {
    const result = await getAsset(assetId);
    if (result.success && result.asset) {
      setAsset(result.asset);
      return result.asset;
    }
    return null;
  }, [assetId]);

  // 加载素材详情
  useEffect(() => {
    async function loadAsset() {
      setIsLoading(true);
      try {
        const result = await getAsset(assetId);
        if (result.success && result.asset) {
          setAsset(result.asset);
          setFormData({
            name: result.asset.name,
          });
        } else {
          toast.error("加载素材失败");
          selectResource(null);
        }
      } catch (error) {
        console.error("加载素材失败:", error);
        toast.error("加载素材失败");
        selectResource(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadAsset();
  }, [assetId, selectResource]);

  // 自动保存
  useEffect(() => {
    if (!asset || saveStatus !== "idle") return;

    // 检查是否有变更
    const hasChanges = formData.name !== asset.name;

    if (!hasChanges) return;

    const timer = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const result = await updateAsset(assetId, {
          name: formData.name,
        });

        if (result.success) {
          // 重新加载素材数据
          await refreshAsset();
          
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
          
          // 触发素材更新事件，通知素材列表刷新
          window.dispatchEvent(new CustomEvent("asset-created"));
        } else {
          setSaveStatus("error");
          toast.error(result.error || "保存失败");
        }
      } catch (error) {
        console.error("保存素材失败:", error);
        setSaveStatus("error");
        toast.error("保存失败");
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [assetId, asset, formData, saveStatus, refreshAsset]);

  // 删除素材
  const handleDelete = useCallback(async () => {
    if (!asset) return;

    setIsDeleting(true);
    try {
      const result = await deleteAsset(asset.id);
      if (result.success) {
        toast.success("素材已删除");
        selectResource(null);
        
        // 触发素材更新事件，通知素材列表刷新
        window.dispatchEvent(new CustomEvent("asset-created"));
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      console.error("删除素材失败:", error);
      toast.error("删除失败");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [asset, selectResource]);

  // 下载图片
  const handleDownload = useCallback(() => {
    if (!asset || !asset.imageUrl) return;
    window.open(asset.imageUrl, "_blank");
  }, [asset]);

  // 派生成功回调
  const handleDeriveSuccess = useCallback(() => {
    window.dispatchEvent(new CustomEvent("asset-created"));
  }, []);
  
  // 添加标签
  const handleAddTag = useCallback(async () => {
    if (!newTagValue.trim()) {
      toast.error("标签不能为空");
      return;
    }
    
    try {
      const result = await addAssetTag({
        assetId,
        tagValue: newTagValue.trim(),
      });
      
      if (result.success) {
        toast.success("标签已添加");
        setNewTagValue("");
        setIsAddingTag(false);
        
        // 重新加载素材数据
        await refreshAsset();
        
        // 触发素材更新事件
        window.dispatchEvent(new CustomEvent("asset-created"));
      } else {
        toast.error(result.error || "添加标签失败");
      }
    } catch (error) {
      console.error("添加标签失败:", error);
      toast.error("添加标签失败");
    }
  }, [assetId, newTagValue, refreshAsset]);
  
  // 删除标签
  const handleRemoveTag = useCallback(async (tagId: string) => {
    setRemovingTagIds((prev) => new Set(prev).add(tagId));
    
    try {
      const result = await removeAssetTag(tagId);
      
      if (result.success) {
        toast.success("标签已删除");
        
        // 重新加载素材数据
        await refreshAsset();
        
        // 触发素材更新事件
        window.dispatchEvent(new CustomEvent("asset-created"));
      } else {
        toast.error(result.error || "删除标签失败");
      }
    } catch (error) {
      console.error("删除标签失败:", error);
      toast.error("删除标签失败");
    } finally {
      setRemovingTagIds((prev) => {
        const next = new Set(prev);
        next.delete(tagId);
        return next;
      });
    }
  }, [refreshAsset]);
  
  // 切换添加标签输入框
  const toggleAddTag = useCallback(() => {
    setIsAddingTag((prev) => !prev);
    setNewTagValue("");
  }, []);
  
  // 处理标签输入框的回车键
  const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === "Escape") {
      setIsAddingTag(false);
      setNewTagValue("");
    }
  }, [handleAddTag]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>素材不存在</p>
        </div>
      </div>
    );
  }

  const meta = parseAssetMeta(asset.meta);

  return (
    <>
      <div className="h-full flex flex-col">
        {/* 头部工具栏 - 显示素材名称并支持内联编辑 */}
        <div className="border-b bg-card/50 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <ImageIcon className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <EditableInput
                  value={formData.name}
                  onChange={(value) => setFormData({ ...formData, name: value })}
                  placeholder="输入素材名称"
                  emptyText="点击输入素材名称"
                  className="text-base font-semibold"
                  inputClassName="text-base font-semibold"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {saveStatus === "saving" && (
                <div className="flex items-center gap-1.5 text-xs mr-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">保存中...</span>
                </div>
              )}
              {saveStatus === "saved" && (
                <div className="flex items-center gap-1.5 text-xs mr-2">
                  <span className="text-green-600">✓ 已保存</span>
                </div>
              )}
              {saveStatus === "error" && (
                <div className="flex items-center gap-1.5 text-xs mr-2">
                  <span className="text-destructive">保存失败</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                title="下载"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteDialogOpen(true)}
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeriveDialogOpen(true)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              派生创作
            </Button>
          </div>
        </div>

        {/* 内容区域 - 响应式左右布局 */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* 左侧：图片预览区域 */}
              <div className="w-full lg:w-1/2">
                <div className="relative w-full aspect-video bg-muted/30 rounded-lg overflow-hidden border">
                  {asset.imageUrl ? (
                    <Image
                      src={asset.imageUrl}
                      alt={asset.name}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
                      <span className="text-sm text-muted-foreground mt-3">图片生成中...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：信息区域 */}
              <div className="w-full lg:w-1/2 space-y-6">
                {/* 标签管理 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      标签管理
                    </h3>
                    {!isAddingTag && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleAddTag}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        添加标签
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {/* 现有标签 */}
                    {asset.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="pl-2.5 pr-1.5 py-1 text-sm flex items-center gap-1.5 group"
                      >
                        <span>{tag.tagValue}</span>
                        <button
                          onClick={() => handleRemoveTag(tag.id)}
                          disabled={removingTagIds.has(tag.id)}
                          className="ml-1 hover:bg-destructive/90 hover:text-white rounded-sm p-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title="删除标签"
                        >
                          {removingTagIds.has(tag.id) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                        </button>
                      </Badge>
                    ))}
                    
                    {/* 添加标签输入框 */}
                    {isAddingTag && (
                      <div className="flex items-center gap-2 w-full">
                        <Input
                          value={newTagValue}
                          onChange={(e) => setNewTagValue(e.target.value)}
                          onKeyDown={handleTagInputKeyDown}
                          placeholder="输入标签名称"
                          className="h-8 flex-1 text-sm"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={handleAddTag}
                          className="h-8 px-3"
                        >
                          确定
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsAddingTag(false);
                            setNewTagValue("");
                          }}
                          className="h-8 px-3"
                        >
                          取消
                        </Button>
                      </div>
                    )}
                    
                    {/* 无标签提示 */}
                    {asset.tags.length === 0 && !isAddingTag && (
                      <p className="text-sm text-muted-foreground italic">
                        暂无标签，点击&quot;添加标签&quot;按钮添加
                      </p>
                    )}
                  </div>
                </div>

                <Separator />
                
                {/* 生成提示词 */}
                {asset.prompt && (
                  <>
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        生成提示词
                      </h3>
                      <div className="px-3 py-2.5 rounded-md border bg-muted/20 text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {asset.prompt}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* 技术信息 */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    技术信息
                  </h3>

                  <div className="grid grid-cols-1 gap-4 text-sm">
                    {asset.seed && (
                      <div>
                        <p className="text-muted-foreground mb-1 flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          Seed
                        </p>
                        <p className="font-mono">{asset.seed}</p>
                      </div>
                    )}

                    {asset.modelUsed && (
                      <div>
                        <p className="text-muted-foreground mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          模型
                        </p>
                        <p>{asset.modelUsed}</p>
                      </div>
                    )}

                    {asset.derivationType && (
                      <div>
                        <p className="text-muted-foreground mb-1 flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          派生类型
                        </p>
                        <p>{asset.derivationType}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        创建时间
                      </p>
                      <p>{new Date(asset.createdAt).toLocaleString("zh-CN")}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        更新时间
                      </p>
                      <p>{new Date(asset.updatedAt).toLocaleString("zh-CN")}</p>
                    </div>
                  </div>
                </div>

                {/* 元数据详情 */}
                {meta && Object.keys(meta).length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        详细信息
                      </h3>
                      <pre className="text-xs bg-muted/30 p-3 rounded-md overflow-auto max-h-60">
                        {JSON.stringify(meta, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 派生对话框 */}
      <AssetDeriveDialog
        open={deriveDialogOpen}
        onOpenChange={setDeriveDialogOpen}
        sourceAsset={asset}
        onSuccess={handleDeriveSuccess}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除素材 &quot;{asset.name}&quot; 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

