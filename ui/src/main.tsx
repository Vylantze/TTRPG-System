import React from 'react';
import { createRoot } from 'react-dom/client';
import { DatabaseApp } from '@/ui/src/DatabaseApp';
import '@/ui/src/styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><DatabaseApp /></React.StrictMode>);
