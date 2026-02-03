import { Button } from "./ui/button";

interface WindowShellProps {
  title: string;
  subtitle?: string;
  onReattach?: () => void;
  children: React.ReactNode;
}

export function WindowShell({
  title,
  subtitle,
  onReattach,
  children,
}: WindowShellProps) {
  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {subtitle && (
            <span className="text-xs text-muted-foreground">({subtitle})</span>
          )}
        </div>
        {onReattach && (
          <Button variant="ghost" size="sm" onClick={onReattach}>
            ← Back to Main
          </Button>
        )}
      </header>
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}
