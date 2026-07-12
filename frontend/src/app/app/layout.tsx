'use client';

import React from 'react';
import LayoutShell from '../../components/LayoutShell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <LayoutShell>{children}</LayoutShell>;
}
