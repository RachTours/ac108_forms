import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const cost = 32_768;
const blockSize = 8;
const parallelization = 1;
const keyLength = 32;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, { N: cost, r: blockSize, p: parallelization, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, costText, blockText, parallelText, saltText, keyText, extra] = encoded.split("$");
  if (algorithm !== "scrypt" || !costText || !blockText || !parallelText || !saltText || !keyText || extra !== undefined) return false;
  const parsedCost = Number(costText);
  const parsedBlock = Number(blockText);
  const parsedParallel = Number(parallelText);
  if (parsedCost !== cost || parsedBlock !== blockSize || parsedParallel !== parallelization) return false;
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(keyText, "base64url");
  if (salt.length !== 16 || expected.length !== keyLength) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected);
}
