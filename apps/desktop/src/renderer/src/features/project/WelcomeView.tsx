import { useEffect, useState } from "react";
import {
  FolderOpen,
  Plus,
  Clock,
  Globe,
  Smartphone,
  Monitor,
  Zap,
} from "lucide-react";
import logoUrl from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { NewProjectDialog } from "./NewProjectDialog";
import { IpcChannels } from "@jkauto/core";
import type { RecentProject, Project } from "@jkauto/core";
import { invoke } from "@/lib/utils";
import { useProjectStore } from "@/store/project.store";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, React.ElementType> = {
  web: Globe,
  mobile: Smartphone,
  desktop: Monitor,
  api: Zap,
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString();
}

export function WelcomeView() {
  const [showNew, setShowNew] = useState(false);
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const addProject = useProjectStore((s) => s.addProject);

  useEffect(() => {
    invoke<RecentProject[]>(IpcChannels.PROJECT_GET_RECENT)
      .then(setRecents)
      .catch(() => {});
  }, []);

  const handleOpen = async () => {
    const result = await invoke<{
      projectPath: string;
      project: Project;
    } | null>(IpcChannels.PROJECT_OPEN_DIALOG);
    if (result) {
      addProject(result.projectPath, result.project);
    }
  };

  const handleOpenRecent = async (recent: RecentProject) => {
    try {
      const result = await invoke<{ projectPath: string; project: Project }>(
        IpcChannels.PROJECT_OPEN,
        recent.path,
      );
      addProject(result.projectPath, result.project);
    } catch {
      setRecents((prev) => prev.filter((r) => r.path !== recent.path));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background gap-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <img
          src={logoUrl}
          className="w-20 h-20 object-contain drop-shadow-lg"
          alt="JKAuto"
        />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">JKAuto</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automation Test Platform
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
        <Button variant="outline" onClick={handleOpen} className="gap-2">
          <FolderOpen className="w-4 h-4" />
          Open Project
        </Button>
      </div>

      {/* Recent */}
      <div className="w-96">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Clock className="w-3.5 h-3.5" />
          Recent Projects
        </div>
        {recents.length === 0 ? (
          <div className="text-xs text-muted-foreground/50 italic text-center py-4">
            No recent projects
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {recents.map((r) => {
              const Icon = TYPE_ICON[r.type] ?? Globe;
              return (
                <button
                  key={r.path}
                  onClick={() => handleOpenRecent(r)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-left",
                    "hover:bg-secondary/60 transition-colors",
                  )}
                >
                  <Icon className="w-4 h-4 text-primary/70 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {r.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {r.path}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground/60 shrink-0">
                    {formatDate(r.openedAt)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <NewProjectDialog open={showNew} onOpenChange={setShowNew} />
    </div>
  );
}
