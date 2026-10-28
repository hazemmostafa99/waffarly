import { createContext, type Dispatch, type SetStateAction } from 'react';

export const PageTitleContext = createContext<{
  title: string;
  setTitle: Dispatch<SetStateAction<string | null>>;
} | null>(null);
