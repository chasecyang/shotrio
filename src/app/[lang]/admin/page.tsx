import { Card } from "@/components/ui/card";

export default async function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Admin Panel</h2>
        <p className="text-muted-foreground">Manage your application</p>
      </div>

      <Card className="p-8 border-border">
        <div className="text-center text-muted-foreground">
          <p className="text-lg">Admin features under development...</p>
        </div>
      </Card>
    </div>
  );
}
