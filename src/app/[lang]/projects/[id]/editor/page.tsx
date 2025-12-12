import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getProjectDetail } from "@/lib/actions/project";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { EditorLayout } from "@/components/projects/editor/editor-layout";
import { ResourcePanel } from "@/components/projects/editor/resource-panel/resource-panel";
import { PreviewPanel } from "@/components/projects/editor/preview-panel/preview-panel";
import { EditorSkeleton } from "./loading";

interface EditorPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id: projectId } = await params;

  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorWrapper projectId={projectId} userId={user.id} />
    </Suspense>
  );
}

async function EditorWrapper({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) {
  const project = await getProjectDetail(projectId);

  if (!project) {
    notFound();
  }

  return (
    <EditorLayout
      project={project}
      userId={userId}
      resourcePanel={<ResourcePanel />}
      previewPanel={<PreviewPanel />}
    />
  );
}

