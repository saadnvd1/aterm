import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  isOpen: boolean;
  activePtyCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExitConfirmDialog({ isOpen, activePtyCount, onConfirm, onCancel }: Props) {
  const hasActiveProcesses = activePtyCount > 0;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exit aTerm?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasActiveProcesses ? (
              <>
                You have <strong>{activePtyCount}</strong> active terminal
                {activePtyCount === 1 ? " session" : " sessions"} running
                (dev servers, Claude sessions, etc.).
                <br /><br />
                Exiting will <strong>force kill</strong> all of them.
              </>
            ) : (
              "Are you sure you want to exit?"
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={hasActiveProcesses ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {hasActiveProcesses ? "Kill All & Exit" : "Exit"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
