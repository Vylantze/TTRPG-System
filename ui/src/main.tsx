import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/ui/src/App';
import '@/ui/src/styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
