export interface CheatItem {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  content?: string;
  commands?: string[];
  command?: string;
  code?: string;
  name?: string;
}

export interface CheatCategory {
  category: string;
  count: number;
}

export interface CommandItem {
  id: string;
  command: string;
  description: string;
  category: string;
  createdAt?: string;
}

const BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  cheats: {
    search: (q: string) => fetchJSON<CheatItem[]>(`/cheats/search?q=${encodeURIComponent(q)}`),
    categories: () => fetchJSON<CheatCategory[]>(`/cheats/categories`),
    local: (q: string) => fetchJSON<{ results: CheatItem[]; categories: CheatCategory[] }>(`/cheats/local?q=${encodeURIComponent(q)}`),
    browse: (category: string, page?: number) => fetchJSON<CheatItem[]>(`/cheats/browse?category=${encodeURIComponent(category)}${page ? `&page=${page}` : ''}`),
  },
  commands: {
    list: () => fetchJSON<CommandItem[]>(`/commands`),
    create: (cmd: Omit<CommandItem, 'id' | 'createdAt'>) =>
      fetchJSON<CommandItem>(`/commands`, { method: 'POST', body: JSON.stringify(cmd) }),
    update: (id: string, cmd: Partial<CommandItem>) =>
      fetchJSON<CommandItem>(`/commands/${id}`, { method: 'PUT', body: JSON.stringify(cmd) }),
    delete: (id: string) => fetchJSON<void>(`/commands/${id}`, { method: 'DELETE' }),
    categories: () => fetchJSON<string[]>(`/commands/categories`),
  },
};
