export const AI_LIBRARY_DEVELOPER_EMAIL = 'hkd620@gmail.com';

export function hasAiLibraryAccess(
  email: string | null | undefined,
  emailVerified: boolean | null | undefined,
): boolean {
  return email?.trim().toLowerCase() === AI_LIBRARY_DEVELOPER_EMAIL && emailVerified === true;
}
