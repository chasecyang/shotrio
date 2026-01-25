"use client";

import { useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Play, Plus, Trash2, Edit, Search } from "lucide-react";
import {
  markAssetAsExample,
  unmarkAssetAsExample,
  updateExampleAssetInfo,
} from "@/lib/actions/admin/example-admin";

interface Asset {
  id: string;
  name: string;
  assetType: string;
  imageUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  isExample: boolean;
  creatorName: string | null;
  creatorEmail: string | null;
  projectTitle: string | null;
  createdAt: Date;
}

interface Example {
  assetId: string;
  assetName: string;
  assetType: string;
  imageUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  order: number;
  displayName: string | null;
  description: string | null;
  creatorName: string | null;
  creatorEmail: string | null;
  projectTitle: string | null;
  createdAt: Date;
}

interface ExampleAssetManagerProps {
  examples: Example[];
  assets: Asset[];
}

export function ExampleAssetManager({ examples: initialExamples, assets: initialAssets }: ExampleAssetManagerProps) {
  const [examples, setExamples] = useState(initialExamples);
  const [assets] = useState(initialAssets);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editingExample, setEditingExample] = useState<Example | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    order: 0,
    displayName: "",
    description: "",
  });

  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddExample = async () => {
    if (!selectedAsset) return;

    const result = await markAssetAsExample(selectedAsset.id, {
      order: formData.order,
      displayName: formData.displayName || undefined,
      description: formData.description || undefined,
    });

    if (result.success) {
      toast.success("已添加为示例资产");
      // 刷新页面
      window.location.reload();
    } else {
      toast.error(result.error || "添加失败");
    }

    setIsAddDialogOpen(false);
    setSelectedAsset(null);
    setFormData({ order: 0, displayName: "", description: "" });
  };

  const handleUpdateExample = async () => {
    if (!editingExample) return;

    const result = await updateExampleAssetInfo(editingExample.assetId, {
      order: formData.order,
      displayName: formData.displayName || undefined,
      description: formData.description || undefined,
    });

    if (result.success) {
      toast.success("已更新示例信息");
      // 刷新页面
      window.location.reload();
    } else {
      toast.error(result.error || "更新失败");
    }

    setIsEditDialogOpen(false);
    setEditingExample(null);
    setFormData({ order: 0, displayName: "", description: "" });
  };

  const handleRemoveExample = async (assetId: string) => {
    if (!confirm("确定要移除这个示例吗？")) return;

    const result = await unmarkAssetAsExample(assetId);

    if (result.success) {
      toast.success("已移除示例");
      setExamples(examples.filter((ex) => ex.assetId !== assetId));
    } else {
      toast.error(result.error || "移除失败");
    }
  };

  const openAddDialog = (asset: Asset) => {
    setSelectedAsset(asset);
    setFormData({
      order: 0,
      displayName: asset.name,
      description: "",
    });
    setIsAddDialogOpen(true);
  };

  const openEditDialog = (example: Example) => {
    setEditingExample(example);
    setFormData({
      order: example.order,
      displayName: example.displayName || example.assetName,
      description: example.description || "",
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Current Examples Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">当前示例资产 ({examples.length})</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">预览</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="w-[100px]">排序</TableHead>
                <TableHead>创建者</TableHead>
                <TableHead className="w-[150px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {examples.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    暂无示例资产
                  </TableCell>
                </TableRow>
              ) : (
                examples.map((example) => (
                  <TableRow key={example.assetId}>
                    <TableCell>
                      <div className="relative w-16 h-16 rounded overflow-hidden bg-muted">
                        {example.thumbnailUrl && (
                          <Image
                            src={example.thumbnailUrl}
                            alt={example.assetName}
                            fill
                            className="object-cover"
                          />
                        )}
                        {example.assetType === "video" && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{example.displayName || example.assetName}</div>
                        {example.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {example.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{example.assetType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>{example.order}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {example.creatorName || example.creatorEmail || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(example)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemoveExample(example.assetId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Asset Browser Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">浏览资产</h2>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索资产名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Asset Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden">
              <div className="relative aspect-square bg-muted">
                {asset.thumbnailUrl && (
                  <Image
                    src={asset.thumbnailUrl}
                    alt={asset.name}
                    fill
                    className="object-cover"
                  />
                )}
                {asset.assetType === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                )}
                {asset.isExample && (
                  <Badge className="absolute top-2 right-2" variant="secondary">
                    已添加
                  </Badge>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-medium text-sm line-clamp-2 mb-2">{asset.name}</h3>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">{asset.assetType}</Badge>
                  {!asset.isExample && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAddDialog(asset)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加为示例资产</DialogTitle>
            <DialogDescription>
              设置示例资产的展示信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="order">排序权重</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                placeholder="数字越大越靠前"
              />
            </div>
            <div>
              <Label htmlFor="displayName">展示名称（可选）</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="留空使用原始名称"
              />
            </div>
            <div>
              <Label htmlFor="description">描述（可选）</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="添加描述信息"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddExample}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑示例信息</DialogTitle>
            <DialogDescription>
              修改示例资产的展示信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-order">排序权重</Label>
              <Input
                id="edit-order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                placeholder="数字越大越靠前"
              />
            </div>
            <div>
              <Label htmlFor="edit-displayName">展示名称（可选）</Label>
              <Input
                id="edit-displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="留空使用原始名称"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">描述（可选）</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="添加描述信息"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateExample}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
