export const MAX_FORM_PHOTOS = 15;

export const FORM_PHOTO_LIMIT_MESSAGE =
  "Ya alcanzaste el máximo de 15 fotos. Eliminá alguna para tomar o cargar más.";

export function isAtFormPhotoLimit(count: number): boolean {
  return count >= MAX_FORM_PHOTOS;
}
