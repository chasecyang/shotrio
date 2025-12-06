"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateShot, deleteShot } from "@/lib/actions/project-actions";
import { toast } from "sonner";
import { Edit, Save, X, Trash2, Loader2, Clock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Shot {
  id: string;
  order: number;
  shotSize: string;
  visualDescription: string | null;
  dialogue: string | null;
  duration: number | null;
}

interface ShotCardProps {
  shot: Shot;
  onUpdate: (shotId: string, updatedData: Partial<Shot>) => void;
  onDelete: (shotId: string) => void;
}

const SHOT_SIZE_LABELS: Record<string, string> = {
  extreme_long_shot: "大远景",
  long_shot: "远景",
  full_shot: "全景",
  medium_shot: "中景",
  close_up: "特写",
  extreme_close_up: "大特写",
};

export function ShotCard({ shot, onUpdate, onDelete }: ShotCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editData, setEditData] = useState({
    shotSize: shot.shotSize,
    visualDescription: shot.visualDescription || "",
    dialogue: shot.dialogue || "",
  });

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateShot(shot.id, editData);

      if (result.success) {
        toast.success("保存成功");
        setIsEditing(false);
        onUpdate(shot.id, editData);
      } else {
        toast.error(result.error || "保存失败");
      }
    } catch (error) {
      toast.error("保存失败，请重试");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const result = await deleteShot(shot.id);

      if (result.success) {
        toast.success("删除成功");
        onDelete(shot.id);
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      toast.error("删除失败，请重试");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  }

  function handleCancel() {
    setEditData({
      shotSize: shot.shotSize,
      visualDescription: shot.visualDescription || "",
      dialogue: shot.dialogue || "",
    });
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <Card className="p-4">
        <div className="space-y-4">
          {/* 头部：镜号和景别选择 */}
          <div className="flex items-center justify-between">
            <Badge variant="default" className="font-mono">
              镜 {shot.order}
            </Badge>
          </div>

          {/* 景别选择 */}
          <div className="space-y-2">
            <Label>景别</Label>
            <Select
              value={editData.shotSize}
              onValueChange={(value) =>
                setEditData({ ...editData, shotSize: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SHOT_SIZE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 画面描述 */}
          <div className="space-y-2">
            <Label>画面描述</Label>
            <Textarea
              value={editData.visualDescription}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  visualDescription: e.target.value,
                })
              }
              placeholder="描述这个镜头的画面..."
              rows={3}
            />
          </div>

          {/* 台词 */}
          <div className="space-y-2">
            <Label>台词/旁白</Label>
            <Textarea
              value={editData.dialogue}
              onChange={(e) =>
                setEditData({ ...editData, dialogue: e.target.value })
              }
              placeholder="这个镜头的台词或旁白..."
              rows={2}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {!saving && <Save className="mr-2 h-4 w-4" />}
              保存
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
              size="sm"
            >
              <X className="mr-2 h-4 w-4" />
              取消
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* 头部：镜号、景别、操作按钮 */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="font-mono">
              镜 {shot.order}
            </Badge>
            <Badge variant="outline">{SHOT_SIZE_LABELS[shot.shotSize] || shot.shotSize}</Badge>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除镜头？</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作无法撤销。镜头 {shot.order} 将被永久删除。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    确认删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* 画面描述 */}
        {shot.visualDescription && (
          <div>
            <p className="text-sm text-foreground line-clamp-3">
              {shot.visualDescription}
            </p>
          </div>
        )}

        {/* 台词 */}
        {shot.dialogue && (
          <div className="bg-muted/50 p-2 rounded-md">
            <p className="text-xs text-muted-foreground italic">
              "{shot.dialogue}"
            </p>
          </div>
        )}

        {/* 时长 */}
        {shot.duration && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{(shot.duration / 1000).toFixed(1)}s</span>
          </div>
        )}
      </div>
    </Card>
  );
}

