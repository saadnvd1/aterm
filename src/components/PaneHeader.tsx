import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Calculate relative luminance to determine if text should be light or dark
function getLuminance(hex: string): number {
  // Remove # if present
  const color = hex.replace("#", "");
  const r = parseInt(color.slice(0, 2), 16) / 255;
  const g = parseInt(color.slice(2, 4), 16) / 255;
  const b = parseInt(color.slice(4, 6), 16) / 255;

  // Apply gamma correction
  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function shouldUseLightText(bgColor: string): boolean {
  return getLuminance(bgColor) < 0.5;
}

interface Props {
  title: string;
  subtitle?: string;
  accentColor?: string;
  projectColor?: string; // If set, tints the entire header background
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
  projectColor,
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

  // Generate background from project color and determine text color
  const useLightText = projectColor ? shouldUseLightText(projectColor) : false;
  const headerStyle = projectColor
    ? {
        backgroundColor: projectColor,
        borderBottomColor: projectColor,
      }
    : undefined;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2 border-b border-border cursor-grab shrink-0 transition-colors",
        !projectColor && (isFocused ? "bg-accent" : "bg-secondary")
      )}
      style={headerStyle}
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
            className={cn(
              "text-xs font-medium",
              useLightText ? "text-white" : "text-foreground"
            )}
            onDoubleClick={handleDoubleClick}
            title={onRename ? "Double-click to rename" : undefined}
          >
            {title}
          </span>
        )}
        {titleExtra}
      </div>
      <div className="flex items-center gap-2">
        {subtitle && (
          <span
            className={cn(
              "text-[11px]",
              useLightText ? "text-white/70" : "text-muted-foreground"
            )}
          >
            {subtitle}
          </span>
        )}
        {actions}
        {canClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              "h-5 w-5 opacity-60 hover:opacity-100",
              useLightText && "text-white hover:bg-white/20"
            )}
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
