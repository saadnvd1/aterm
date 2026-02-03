import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { ATColorDot } from "@/components/ui/at-color-dot";
import { AppearanceTab, ProfilesTab, LayoutsTab, SSHConnectionsTab } from "./settings";
import type { AppConfig } from "../lib/config";
import type { TerminalProfile } from "../lib/profiles";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
}

interface ITermProfile {
  name: string;
  guid: string;
  command: string | null;
  workingDirectory: string | null;
}

// Generate a color from a string (deterministic hash)
function stringToColor(str: string): string {
  const colors = [
    "#7c5cff", "#00d4aa", "#ff6b6b", "#4ecdc4", "#ffe66d",
    "#f97316", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function SettingsModal({ isOpen, onClose, config, onConfigChange }: Props) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [itermProfiles, setItermProfiles] = useState<ITermProfile[]>([]);
  const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(console.error);
  }, []);

  async function handleImportClick() {
    setImportError(null);
    try {
      const profiles = await invoke<ITermProfile[]>("get_iterm_profiles");
      setItermProfiles(profiles);
      setSelectedImports(new Set(profiles.map(p => p.guid)));
      setShowImportModal(true);
    } catch (e) {
      setImportError(e as string);
    }
  }

  function handleImportConfirm() {
    const newProfiles: TerminalProfile[] = itermProfiles
      .filter(p => selectedImports.has(p.guid))
      .map(p => ({
        id: `iterm-${p.guid}`,
        name: p.name,
        command: p.command || undefined,
        color: stringToColor(p.guid),
      }));

    // Merge with existing, avoiding duplicates by id
    const existingIds = new Set(config.profiles.map(p => p.id));
    const toAdd = newProfiles.filter(p => !existingIds.has(p.id));

    if (toAdd.length > 0) {
      onConfigChange({ ...config, profiles: [...config.profiles, ...toAdd] });
    }

    setShowImportModal(false);
  }

  function toggleImport(guid: string) {
    const newSet = new Set(selectedImports);
    if (newSet.has(guid)) {
      newSet.delete(guid);
    } else {
      newSet.add(guid);
    }
    setSelectedImports(newSet);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[560px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="profiles">Profiles</TabsTrigger>
            <TabsTrigger value="layouts">Layouts</TabsTrigger>
            <TabsTrigger value="ssh">SSH</TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="flex-1 overflow-auto mt-4">
            <AppearanceTab
              defaultFontSize={config.defaultFontSize ?? 13}
              defaultScrollback={config.defaultScrollback ?? 10000}
              appVersion={appVersion}
              onFontSizeChange={(size) => onConfigChange({ ...config, defaultFontSize: size })}
              onScrollbackChange={(size) => onConfigChange({ ...config, defaultScrollback: size })}
            />
          </TabsContent>

          <TabsContent value="profiles" className="flex-1 overflow-auto mt-4">
            <ProfilesTab
              profiles={config.profiles}
              projects={config.projects}
              onProfilesChange={(profiles) => onConfigChange({ ...config, profiles })}
              onImportClick={handleImportClick}
              importError={importError}
            />
          </TabsContent>

          <TabsContent value="layouts" className="flex-1 overflow-auto mt-4">
            <LayoutsTab
              layouts={config.layouts}
              profiles={config.profiles}
              onLayoutsChange={(layouts) => onConfigChange({ ...config, layouts })}
            />
          </TabsContent>

          <TabsContent value="ssh" className="flex-1 overflow-auto mt-4">
            <SSHConnectionsTab
              connections={config.sshConnections || []}
              onConnectionsChange={(sshConnections) => onConfigChange({ ...config, sshConnections })}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* iTerm2 Import Modal */}
      <ITermImportModal
        isOpen={showImportModal}
        profiles={itermProfiles}
        selectedImports={selectedImports}
        onClose={() => setShowImportModal(false)}
        onToggleImport={toggleImport}
        onSelectAll={() => setSelectedImports(new Set(itermProfiles.map(p => p.guid)))}
        onSelectNone={() => setSelectedImports(new Set())}
        onConfirm={handleImportConfirm}
      />
    </Dialog>
  );
}

interface ITermImportModalProps {
  isOpen: boolean;
  profiles: ITermProfile[];
  selectedImports: Set<string>;
  onClose: () => void;
  onToggleImport: (guid: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onConfirm: () => void;
}

function ITermImportModal({
  isOpen,
  profiles,
  selectedImports,
  onClose,
  onToggleImport,
  onSelectAll,
  onSelectNone,
  onConfirm,
}: ITermImportModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[400px] max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import iTerm2 Profiles</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <p className="text-xs text-muted-foreground mb-3">
            Select profiles to import ({selectedImports.size} of {profiles.length} selected)
          </p>

          <div className="flex flex-col gap-1.5">
            {profiles.map((profile) => (
              <label
                key={profile.guid}
                className="flex items-center gap-2.5 px-3 py-2 bg-muted rounded-md border border-border cursor-pointer hover:border-muted-foreground/30"
              >
                <Checkbox
                  checked={selectedImports.has(profile.guid)}
                  onCheckedChange={() => onToggleImport(profile.guid)}
                />
                <ATColorDot color={stringToColor(profile.guid)} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">
                    {profile.name}
                  </div>
                  {profile.command && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {profile.command}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-border">
          <div className="flex gap-2">
            <Button
              variant="link"
              size="sm"
              className="h-6 px-0 text-[11px]"
              onClick={onSelectAll}
            >
              Select all
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-6 px-0 text-[11px]"
              onClick={onSelectNone}
            >
              Select none
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={selectedImports.size === 0}
            >
              Import {selectedImports.size}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
