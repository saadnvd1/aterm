import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  accentColor?: string;
  isFocused?: boolean;
  canClose?: boolean;
  onClose?: () => void;
  onRename?: (name: string) => void;
  triggerRename?: boolean;
  onTriggerRenameComplete?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  titleExtra?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PaneHeader({
  title,
  subtitle,
  accentColor,
  isFocused,
  canClose,
  onClose,
  onRename,
  triggerRename,
  onTriggerRenameComplete,
  dragHandleProps,
  titleExtra,
  actions,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trigger rename from external source (context menu)
  useEffect(() => {
    if (triggerRename && onRename) {
      setEditValue(title);
      setIsEditing(true);
      onTriggerRenameComplete?.();
    }
  }, [triggerRename, title, onRename, onTriggerRenameComplete]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function handleDoubleClick(e: React.MouseEvent) {
    if (onRename) {
      e.stopPropagation();
      setEditValue(title);
      setIsEditing(true);
    }
  }

  function handleBlur() {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onRename?.(trimmed);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(title);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2 border-b border-border cursor-grab shrink-0 transition-colors",
        isFocused ? "bg-accent" : "bg-secondary"
      )}
      {...dragHandleProps}
    >
      <div className="flex items-center gap-2">
        {accentColor && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
          />
        )}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="text-xs font-medium text-foreground bg-background border border-border rounded px-1 py-0.5 outline-none focus:border-primary w-32"
          />
        ) : (
          <span
            className="text-xs font-medium text-foreground"
            onDoubleClick={handleDoubleClick}
            title={onRename ? "Double-click to rename" : undefined}
          >
            {title}
          </span>
        )}
        {titleExtra}
      </div>
      <div className="flex items-center gap-2">
        {subtitle && <span className="text-[11px] text-muted-foreground">{subtitle}</span>}
        {actions}
        {canClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-5 w-5 opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            title="Close pane"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
