import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight } from "lucide-react";
import { getProviderList, PROVIDERS, ProviderId } from "../../lib/providers";
import { LayoutPreview } from "./LayoutPreview";
import type { ProjectFormFieldsProps } from "./types";

export function ProjectFormFields({
  projectName,
  onProjectNameChange,
  provider,
  onProviderChange,
  layoutId,
  onLayoutIdChange,
  layouts,
  profiles,
  advancedOpen,
  onAdvancedOpenChange,
  skipPermissions,
  onSkipPermissionsChange,
  showNameField = true,
  namePlaceholder,
}: ProjectFormFieldsProps) {
  const providers = getProviderList();
  const selectedLayout = layouts.find((l) => l.id === layoutId);

  return (
    <div className="flex flex-col gap-3.5">
      {showNameField && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Name
          </span>
          <Input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder={namePlaceholder}
          />
        </label>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Provider
        </span>
        <Select value={provider} onValueChange={(v) => onProviderChange(v as ProviderId)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Layout
        </span>
        <div className="flex items-center gap-2">
          <Select value={layoutId} onValueChange={onLayoutIdChange}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {layouts.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedLayout && (
            <LayoutPreview layout={selectedLayout} profiles={profiles} />
          )}
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="border border-border rounded-lg">
        <button
          type="button"
          onClick={() => onAdvancedOpenChange(!advancedOpen)}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-90")}
          />
          Advanced Settings
        </button>
        {advancedOpen && (
          <div className="border-t border-border px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`skipPermissions-${showNameField ? "browse" : "clone"}`}
                checked={skipPermissions}
                onChange={(e) => onSkipPermissionsChange(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-background accent-primary"
              />
              <label
                htmlFor={`skipPermissions-${showNameField ? "browse" : "clone"}`}
                className="cursor-pointer text-sm"
              >
                Auto-approve tool calls
                <span className="ml-1 text-muted-foreground">
                  {PROVIDERS[provider].autoApproveFlag
                    ? `(${PROVIDERS[provider].autoApproveFlag})`
                    : "(not supported)"}
                </span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
