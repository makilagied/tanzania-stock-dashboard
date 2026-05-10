import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto"

const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const COOKIE_NAME = "jolene_mem_sid"

function parseMasterKey(): Buffer | null {
  const raw = process.env.JOLENE_MEMORY_MASTER_KEY?.trim()
  if (!raw) return null

  const b64 = Buffer.from(raw, "base64")
  if (b64.length === 32) return b64

  const hex = Buffer.from(raw.replace(/^0x/i, ""), "hex")
  if (hex.length === 32) return hex

  return null
}

export function isJoleneMemoryMasterKeyConfigured(): boolean {
  return parseMasterKey() !== null
}

export function getJoleneMemoryCookieName(): typeof COOKIE_NAME {
  return COOKIE_NAME
}

function deriveAesKey(masterKey: Buffer, sessionId: string): Buffer {
  return createHmac("sha256", masterKey).update(`jolene-memory-v1|${sessionId}`, "utf8").digest()
}

/** iv (12) + tag (16) + ciphertext — base64url */
export function joleneMemoryEncrypt(sessionId: string, plaintext: string): string | null {
  const master = parseMasterKey()
  if (!master) return null
  const key = deriveAesKey(master, sessionId)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64url")
}

export function joleneMemoryDecrypt(sessionId: string, blob: string): string | null {
  const master = parseMasterKey()
  if (!master) return null
  const key = deriveAesKey(master, sessionId)
  let buf: Buffer
  try {
    buf = Buffer.from(blob, "base64url")
  } catch {
    return null
  }
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) return null
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}

export function newJoleneMemorySessionId(): string {
  return randomBytes(32).toString("hex")
}
