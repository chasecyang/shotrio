import { Link } from "@/i18n/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, ArrowRight, Sparkles } from "lucide-react";

export default async function AdminPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground">
          管理中心
        </h1>
        <p className="text-lg text-muted-foreground">
          管理系统设置和内容
        </p>
      </div>

      {/* Quick Access Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Palette className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">美术风格</CardTitle>
                <CardDescription>管理系统预设风格</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              管理和配置系统美术风格库，为每个风格生成预览图
            </p>
            <Button asChild className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Link href="/admin/art-styles" className="flex items-center justify-center gap-2">
                进入管理
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* 预留未来功能卡片 */}
        <Card className="opacity-60 cursor-not-allowed">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">更多功能</CardTitle>
                <CardDescription>即将推出</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              更多管理功能正在开发中...
            </p>
            <Button disabled className="w-full">
              敬请期待
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Info Section */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground">提示</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                这是系统管理面板，只有管理员才能访问。你可以在这里管理系统的各项设置和内容。
                使用左侧导航栏快速访问不同的管理功能。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
