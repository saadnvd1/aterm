import type { TransientTerminal } from "../lib/transient";
import { TerminalPane } from "./TerminalPane";

interface Props {
  terminal: TransientTerminal;
  defaultFontSize: number;
  defaultScrollback: number;
  onClose: () => void;
}

export function TransientTerminalView({
  terminal,
  defaultFontSize,
  defaultScrollback,
  onClose,
}: Props) {
  return (
    <div className="flex flex-col flex-1 p-2 min-h-0">
      <TerminalPane
        key={terminal.id}
        id={`transient-${terminal.id}`}
        title={terminal.name}
        cwd={terminal.cwd}
        defaultFontSize={defaultFontSize}
        scrollback={defaultScrollback}
        isFocused={true}
        isProjectActive={true}
        canClose={true}
        onClose={onClose}
      />
    </div>
  );
}
