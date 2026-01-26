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
import { Play, Plus, Trash2, Edit, Search, GripVertical } from "lucide-react";
import {
  markAssetAsExample,
  unmarkAssetAsExample,
  updateExampleAssetInfo,
  reorderExampleAssets,
} from "@/lib/actions/admin/example-admin";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";

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

// 可拖拽的表格行组件
function SortableTableRow({
  example,
  onEdit,
  onRemove,
}: {
  example: Example;
  onEdit: (example: Example) => void;
  onRemove: (assetId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: example.assetId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      </TableCell>
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
        <div className="text-sm">
          {example.creatorName || example.creatorEmail || "-"}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(example)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onRemove(example.assetId)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ExampleAssetManager({ examples: initialExamples, assets: initialAssets }: ExampleAssetManagerProps) {
  const [examples, setExamples] = useState(initialExamples);
  const [assets] = useState(initialAssets);
  const t = useTranslations("admin.examples.manager");
  const tCommon = useTranslations("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editingExample, setEditingExample] = useState<Example | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // 表单状态（添加时不需要 order，编辑时需要）
  const [formData, setFormData] = useState({
    order: 0,
    displayName: "",
    description: "",
  });

  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 拖拽排序
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = examples.findIndex((ex) => ex.assetId === active.id);
      const newIndex = examples.findIndex((ex) => ex.assetId === over.id);

      const newExamples = arrayMove(examples, oldIndex, newIndex);
      setExamples(newExamples);

      // 计算新的 order 值（第一个 order 最大）
      const orders = newExamples.map((ex, index) => ({
        assetId: ex.assetId,
        order: newExamples.length - index,
      }));

      const result = await reorderExampleAssets(orders);
      if (!result.success) {
        toast.error(result.error || t("reorderFailed"));
        setExamples(examples); // 回滚
      }
    }
  };

  const handleAddExample = async () => {
    if (!selectedAsset) return;

    const result = await markAssetAsExample(selectedAsset.id, {
      displayName: formData.displayName || undefined,
      description: formData.description || undefined,
    });

    if (result.success) {
      toast.success(t("addedSuccess"));
      // 刷新页面
      window.location.reload();
    } else {
      toast.error(result.error || t("addFailed"));
    }

    setIsAddDialogOpen(false);
    setSelectedAsset(null);
    setFormData({ order: 0, displayName: "", description: "" });
  };

  const handleUpdateExample = async () => {
    if (!editingExample) return;

    const result = await updateExampleAssetInfo(editingExample.assetId, {
      displayName: formData.displayName || undefined,
      description: formData.description || undefined,
    });

    if (result.success) {
      toast.success(t("updatedSuccess"));
      // 刷新页面
      window.location.reload();
    } else {
      toast.error(result.error || t("updateFailed"));
    }

    setIsEditDialogOpen(false);
    setEditingExample(null);
    setFormData({ order: 0, displayName: "", description: "" });
  };

  const handleRemoveExample = async (assetId: string) => {
    if (!confirm(t("confirmRemove"))) return;

    const result = await unmarkAssetAsExample(assetId);

    if (result.success) {
      toast.success(t("removedSuccess"));
      setExamples(examples.filter((ex) => ex.assetId !== assetId));
    } else {
      toast.error(result.error || t("removeFailed"));
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
        <h2 className="text-2xl font-bold mb-4">{t("currentExamples")} ({examples.length})</h2>
        <div className="rounded-md border">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={examples.map((ex) => ex.assetId)}
              strategy={verticalListSortingStrategy}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="w-[100px]">{t("tablePreview")}</TableHead>
                    <TableHead>{t("tableName")}</TableHead>
                    <TableHead>{t("tableType")}</TableHead>
                    <TableHead>{t("tableCreator")}</TableHead>
                    <TableHead className="w-[150px]">{t("tableActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examples.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {t("noExamples")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    examples.map((example) => (
                      <SortableTableRow
                        key={example.assetId}
                        example={example}
                        onEdit={openEditDialog}
                        onRemove={handleRemoveExample}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </SortableContext>
          </DndContext>
        </div>
      </Card>

      {/* Asset Browser Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">{t("browseAssets")}</h2>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
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
                    {t("added")}
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
            <DialogTitle>{t("addAsExample")}</DialogTitle>
            <DialogDescription>
              {t("setDisplayInfo")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="displayName">{t("displayNameOptional")}</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder={t("leaveBlankForOriginal")}
              />
            </div>
            <div>
              <Label htmlFor="description">{t("descriptionOptional")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("addDescription")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleAddExample}>
              {tCommon("add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editExampleInfo")}</DialogTitle>
            <DialogDescription>
              {t("modifyDisplayInfo")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-displayName">{t("displayNameOptional")}</Label>
              <Input
                id="edit-displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder={t("leaveBlankForOriginal")}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">{t("descriptionOptional")}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("addDescription")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleUpdateExample}>
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
