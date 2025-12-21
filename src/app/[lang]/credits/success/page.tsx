import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "支付成功",
  description: "您的支付已成功完成",
};

export default function PaymentSuccessPage() {
  return (
    <div className="container mx-auto py-16 max-w-2xl">
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-3xl">支付成功！</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            您的积分已经到账，可以开始使用了
          </p>

          <div className="flex gap-4 justify-center">
            <Button asChild>
              <Link href="/credits">查看积分余额</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/projects">开始创作</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

