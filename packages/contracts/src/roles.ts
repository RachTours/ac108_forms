export const roles = ["OWNER", "ADMIN", "REVIEWER"] as const;
export type Role = (typeof roles)[number];
