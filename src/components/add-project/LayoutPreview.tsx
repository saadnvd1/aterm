import type { Layout } from "../../lib/layouts";
import type { TerminalProfile } from "../../lib/profiles";

interface LayoutPreviewProps {
  layout: Layout;
  profiles: TerminalProfile[];
}

export function LayoutPreview({ layout, profiles }: LayoutPreviewProps) {
  return (
    <div className="w-12 h-8 flex flex-col gap-px bg-background rounded-sm overflow-hidden shrink-0 border border-border">
      {layout.rows.map((row) => (
        <div key={row.id} className="flex gap-px" style={{ flex: row.flex }}>
          {row.panes.map((pane) => {
            const profile = profiles.find((p) => p.id === pane.profileId);
            return (
              <div
                key={pane.id}
                className="min-h-1 opacity-80"
                style={{ flex: pane.flex, backgroundColor: profile?.color || "#888" }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
