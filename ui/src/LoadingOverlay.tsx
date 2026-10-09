import { useEffect, useRef } from 'react';

/** A modal top-layer indicator blocks pointer, keyboard, and background focus. */
export function LoadingOverlay() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {
      element.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog ref={dialog} className="loading-overlay" aria-label="Loading" onCancel={(event) => event.preventDefault()}>
      <div role="status" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        Loading…
      </div>
    </dialog>
  );
}
