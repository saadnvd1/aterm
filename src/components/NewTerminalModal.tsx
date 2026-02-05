import { useEffect, useState } from "react";
import { Folder, Home } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  label: string;
  path: string;
  icon: typeof Folder;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (cwd: string) => void;
  currentProjectPath: string | null;
  homeDir: string;
}

export function NewTerminalModal({
  isOpen,
  onClose,
  onSelect,
  currentProjectPath,
  homeDir,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const options: Option[] = [];

  if (currentProjectPath) {
    options.push({
      id: "project",
      label: `Current Project`,
      path: currentProjectPath,
      icon: Folder,
    });
  }

  options.push({
    id: "home",
    label: "Home Directory",
    path: homeDir,
    icon: Home,
  });

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const option = options[selectedIndex];
        if (option) {
          onSelect(option.path);
          onClose();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, options, onSelect, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[360px]">
        <DialogHeader>
          <DialogTitle>New Terminal</DialogTitle>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-1">
          {options.map((option, index) => {
            const Icon = option.icon;
            const isSelected = index === selectedIndex;
            return (
              <button
                key={option.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                  isSelected
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/50"
                )}
                onClick={() => {
                  onSelect(option.path);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Icon className="h-4 w-4" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {option.path}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 text-xs text-muted-foreground text-center">
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd> to navigate,{" "}
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to select
        </div>
      </DialogContent>
    </Dialog>
  );
}
