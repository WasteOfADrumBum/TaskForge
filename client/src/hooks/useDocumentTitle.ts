import { useEffect } from 'react';

// Gives a page its own document title (WCAG 2.4.2) and restores the previous one on leave.
export const useDocumentTitle = (title: string) => {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
};
