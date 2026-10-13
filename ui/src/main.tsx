import React from 'react';
import { createRoot } from 'react-dom/client';
import { DatabaseApp } from '@/ui/src/app/DatabaseApp';
import { UiVersion } from '@/ui/src/app/UiVersion';
import '@/ui/src/styles/app.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DatabaseApp />
    <UiVersion />
  </React.StrictMode>,
);
