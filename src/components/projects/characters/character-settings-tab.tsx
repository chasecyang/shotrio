"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { upsertCharacter } from "@/lib/actions/character-actions";
import { Character } from "@/types/project";
import { Loader2, Save, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  name: z.string().min(1, "角色名称不能为空"),
  description: z.string().optional(),
  appearance: z.string().optional(),
});

interface CharacterSettingsTabProps {
  projectId: string;
  character: Character;
  onSuccess?: () => void;
}

export function CharacterSettingsTab({
  projectId,
  character,
  onSuccess,
}: CharacterSettingsTabProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: character.name || "",
      description: character.description || "",
      appearance: character.appearance || "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const result = await upsertCharacter(projectId, {
        id: character.id,
        ...values,
      });

      if (result.success) {
        toast.success("角色设定已更新");
        onSuccess?.();
      } else {
        toast.error(result.error || "保存失败");
      }
    } catch (error) {
      toast.error("发生意外错误");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          完善角色设定后，AI 将更好地理解角色特征，生成更符合预期的造型图片。
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  角色名称
                </FormLabel>
                <FormControl>
                  <Input placeholder="例如：林洛" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  角色设定
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>描述角色的性格、背景故事、核心特征等，帮助 AI 理解角色神态和气质。</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="例如：性格开朗活泼，是学校的人气偶像。出身音乐世家，从小学习钢琴..." 
                    className="resize-none min-h-[120px]"
                    {...field} 
                  />
                </FormControl>
                <FormDescription>
                  简要描述角色的性格和核心特质，这将帮助 AI 生成更贴合角色的造型和表情。
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="appearance"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  外貌描述
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>描述角色的固定外貌特征（发色、瞳色、身材等），作为所有造型的基准。</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="例如：银色长发及腰，红色眼瞳，左眼下方有泪痣，身材纤细修长..." 
                    className="resize-none min-h-[120px]"
                    {...field} 
                  />
                </FormControl>
                <FormDescription>
                  描述角色的固定外貌特征，这将作为所有造型生成的基准，确保角色形象一致。
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              保存设定
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

