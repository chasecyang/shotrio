/**
 * Shared type definitions for Editor components
 */

export interface EditorProject {
  id: string;
  title: string;
  description?: string | null;
}

export interface EditorUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string;
}

