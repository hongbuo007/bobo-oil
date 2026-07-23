export interface User {
  id: string;
  passwordHash: string;   // SHA-256 哈希
  createdAt: string;
  updatedAt: string;
}
