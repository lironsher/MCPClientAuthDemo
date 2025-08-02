import { SignJWT, importPKCS8, KeyLike } from "jose";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
const getUUID = () => crypto.randomUUID();

async function loadPrivateKey(privateKey: string): Promise<KeyLike> {
  try {
    return await importPKCS8(privateKey, "RS256");
  } catch (err) {
    throw new Error(`Failed to load private key: ${err}`);
  }
}

async function createJWT(sub: string, privateKey: string): Promise<string> {
  try {
    const pk = await loadPrivateKey(privateKey);
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({
      nonce: getUUID(),
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(sub)
      .setIssuedAt(now)
      .setExpirationTime(now + 60) // expires in 60 seconds
      .sign(pk);
    return jwt;
  } catch (err) {
    throw new Error(`Failed to create JWT: ${err}`);
  }
}

export async function authenticateClient(
  clientId: string,
  privateKey: string
): Promise<string> {
  try {
    const pem = await fs.readFile(path.join(__dirname, privateKey), "utf8");
    const jwt = await createJWT(clientId, pem);
    return jwt;
  } catch (err) {
    throw new Error(`Failed to authenticate client: ${err}`);
  }
}
