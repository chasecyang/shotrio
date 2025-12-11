export interface ArtStyle {
  id: string;
  name: string;
  nameEn?: string | null;
  description?: string | null;
  prompt: string;
  previewImage?: string | null;
  tags?: string[] | null;
  userId?: string | null;
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SystemArtStyle = Omit<ArtStyle, 'userId'> & { userId: null };
export type UserArtStyle = Omit<ArtStyle, 'userId'> & { userId: string };

