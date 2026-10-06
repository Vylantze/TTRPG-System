import { useEffect, useRef, type ReactNode } from 'react';
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current!;element.showModal();return()=>element.close();},[]);
  return <dialog ref={dialog} className="modal" aria-label={title} onCancel={e=>{e.preventDefault();onClose();}}><div className="row modal-title"><h2>{title}</h2><button className="quiet" aria-label="Close dialog" onClick={onClose}>Close</button></div>{children}</dialog>;
}
