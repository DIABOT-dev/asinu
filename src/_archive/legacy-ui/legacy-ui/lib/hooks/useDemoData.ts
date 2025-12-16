import { useMemo } from 'react';
import { demoData } from '@/demo/demoData';

export const useDemoData = () => {
  return useMemo(() => demoData, []);
};
