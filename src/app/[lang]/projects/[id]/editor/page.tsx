import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getProjectDetail, getUserProjects } from "@/lib/actions/project";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { EditorLayout } from "@/components/projects/editor/editor-layout";
import { EditorSkeleton } from "./loading";

interface EditorPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function EditorPage({ params, searchParams }: EditorPageProps) {
  const { id: projectId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/?login=true&redirect=/projects/${projectId}/editor`);
  }
  const { view } = await searchParams;

  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorWrapper projectId={projectId} initialView={view} />
    </Suspense>
  );
}

async function EditorWrapper({
  projectId,
  initialView,
}: {
  projectId: string;
  initialView?: string;
}) {
  const [project, projects, user] = await Promise.all([
    getProjectDetail(projectId),
    getUserProjects(),
    getCurrentUser(),
  ]);

  if (!project) {
    notFound();
  }

  if (!user) {
    redirect(`/?login=true&redirect=/projects/${projectId}/editor`);
  }

  return (
    <EditorLayout
      project={project}
      initialView={initialView}
      projects={projects.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
      }))}
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      }}
    />
  );
}

