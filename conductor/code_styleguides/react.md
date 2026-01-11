# React Style Guide

## Core Principles

- **Functional Components:** Use functional components with hooks for all new UI code.
- **Hooks:** 
    - Use built-in hooks (`useState`, `useEffect`, `useContext`, `useMemo`, `useCallback`) and custom hooks for logic reuse.
    - Avoid `useEffect` for derived state; calculate values during rendering or use `useMemo`.
    - Follow the "Rules of Hooks" strictly.
- **Next.js:**
    - Use the App Router (`app/` directory) structure.
    - Prefer Server Components for data fetching and static content.
    - Use Client Components (`"use client"`) only when interactivity or browser-specific APIs are needed.
- **State Management:**
    - Use **TanStack Query** for server state (data fetching, caching).
    - Use **Nuqs** for URL-based state management (filters, pagination).
    - Use **React Context** for global UI state (themes, user session) sparingly.

## Component Structure

```tsx
// Imports
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// Types
interface MyComponentProps {
  title: string;
  isActive?: boolean;
}

// Component Definition
export function MyComponent({ title, isActive }: MyComponentProps) {
  // Hooks
  const { data } = useQuery({ ... });

  // Render Logic
  if (!data) return null;

  return (
    <div className={cn("base-class", isActive && "active-class")}>
      <h1>{title}</h1>
    </div>
  );
}
```

## Styling

- Use **Tailwind CSS** for styling.
- Use `cn()` utility (from `clsx` and `tailwind-merge`) for conditional class names.
- Avoid inline styles.

## Performance

- Use `useMemo` for expensive calculations.
- Use `useCallback` for event handlers passed to child components.
- Use `React.lazy` and `Suspense` for code-splitting large components.
