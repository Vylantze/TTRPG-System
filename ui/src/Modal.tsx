import { useEffect, useRef, type ReactNode } from 'react';
export function Modal ({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element = dialog.current!,previous = document.activeElement as HTMLElement | null;element.showModal();return()=>{element.close();if(previous?.isConnected)previous.focus();};},[]);
  return <dialog ref={dialog} className="modal" aria-label={title} onCancel={e=>{e.preventDefault();onClose();}}><div className="row modal-title"><h2>{title}</h2><button className="quiet" aria-label="Close dialog" onClick={onClose}>Close</button></div>{children}</dialog>;
}
