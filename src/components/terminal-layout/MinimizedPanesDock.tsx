import { cn } from "@/lib/utils";
import type { LayoutPane } from "../../lib/layouts";
import type { TerminalProfile } from "../../lib/profiles";

interface MinimizedPaneItem {
  pane: LayoutPane;
  profile: TerminalProfile;
}

interface MinimizedPanesDockProps {
  minimizedPanes: MinimizedPaneItem[];
  onRestore: (paneId: string) => void;
}

export function MinimizedPanesDock({
  minimizedPanes,
  onRestore,
}: MinimizedPanesDockProps) {
  if (minimizedPanes.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 border-t border-border shrink-0">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">
        Minimized
      </span>
      {minimizedPanes.map(({ pane, profile }) => (
        <button
          key={pane.id}
          onClick={() => onRestore(pane.id)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded text-xs",
            "bg-background border border-border",
            "hover:bg-accent hover:border-accent-foreground/20",
            "transition-colors cursor-pointer"
          )}
          title={`Restore ${pane.name || profile.name}`}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: profile.color }}
          />
          <span className="truncate max-w-[120px]">
            {pane.name || profile.name}
          </span>
        </button>
      ))}
    </div>
  );
}
