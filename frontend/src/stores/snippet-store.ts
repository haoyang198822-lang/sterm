import { create } from 'zustand';

interface Snippet {
  id: string;
  label: string;
  command: string;
  tags: string[];
}

interface SnippetStore {
  snippets: Snippet[];
  load: () => void;
  add: (snippet: Snippet) => void;
  remove: (id: string) => void;
}

export const useSnippetStore = create<SnippetStore>((set) => ({
  snippets: [],
  load: () => {},
  add: (snippet) => set((state) => ({ snippets: [...state.snippets, snippet] })),
  remove: (id) => set((state) => ({ snippets: state.snippets.filter((snippet) => snippet.id !== id) })),
}));
