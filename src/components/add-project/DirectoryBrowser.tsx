import { useMemo } from "react";
import Fuse from "fuse.js";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronUp, Folder, GitBranch, Circle, Search } from "lucide-react";
import type { DirectoryBrowserProps } from "./types";

export function DirectoryBrowser({
  currentPath: _currentPath,
  pathInput,
  onPathInputChange,
  onPathSubmit,
  onGoUp,
  entries,
  folderSearch,
  onFolderSearchChange,
  onEntryClick,
}: DirectoryBrowserProps) {
  const fuse = useMemo(
    () =>
      new Fuse(entries, {
        keys: ["name"],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [entries]
  );

  const filteredEntries = folderSearch.trim()
    ? fuse.search(folderSearch).map((result) => result.item)
    : entries;

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onGoUp}
          title="Go up"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Input
          type="text"
          value={pathInput}
          onChange={(e) => onPathInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onPathSubmit()}
          onBlur={onPathSubmit}
          className="flex-1 h-8 text-xs font-mono"
          placeholder="/path/to/directory"
        />
      </div>

      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search folders..."
          value={folderSearch}
          onChange={(e) => onFolderSearchChange(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      <div className="max-h-[180px] overflow-auto border border-border rounded-md mb-4">
        {filteredEntries.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            {folderSearch ? "No matching folders" : "No folders"}
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <button
              key={entry.path}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 bg-transparent border-none border-b border-border text-foreground cursor-pointer text-left text-xs transition-colors hover:bg-accent last:border-b-0",
                !entry.isDir && "opacity-40 cursor-default"
              )}
              onClick={() => onEntryClick(entry)}
              disabled={!entry.isDir}
            >
              <span className="text-[10px] text-primary w-3.5">
                {entry.isGitRepo ? (
                  <GitBranch className="h-3 w-3" />
                ) : entry.isDir ? (
                  <Folder className="h-3 w-3" />
                ) : (
                  <Circle className="h-2 w-2" />
                )}
              </span>
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {entry.name}
              </span>
              {entry.isGitRepo && (
                <span className="text-[9px] px-1.5 py-0.5 bg-muted border border-border rounded text-green-500 uppercase tracking-wider">
                  git
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </>
  );
}
