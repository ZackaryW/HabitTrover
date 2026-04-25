import { auth } from '@/auth'
import { headers } from 'next/headers'
import 'server-only'
import { User, UserData, UserId, getDefaultUsersData } from './types'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import fs from 'fs/promises'
import path from 'path'

/**
 * Loads the raw user store from disk for server-side authentication helpers.
 * Scope: shared auth and API-token lookups.
 */
async function loadUsersDataFromStore(): Promise<UserData> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'auth.json')
    const data = await fs.readFile(filePath, 'utf8')
    return JSON.parse(data) as UserData
  } catch {
    return getDefaultUsersData()
  }
}

/**
 * Returns request headers when the current execution has an active request context.
 * Scope: route handlers and other request-bound server code.
 */
async function getRequestHeaders(): Promise<Headers | null> {
  try {
    return await headers()
  } catch {
    return null
  }
}

/**
 * Extracts a bearer token from request headers if one is present.
 * Scope: API token authentication fallback.
 */
function getBearerToken(requestHeaders: Headers | null): string | undefined {
  const authorizationHeader = requestHeaders?.get('authorization')

  if (!authorizationHeader) {
    return undefined
  }

  const [scheme, token] = authorizationHeader.split(' ')

  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return undefined
  }

  return token.trim() || undefined
}

/**
 * Compares two token strings without leaking timing information on equal-length values.
 * Scope: bearer token authentication.
 */
function tokensMatch(expectedToken: string, actualToken: string): boolean {
  const expectedBuffer = Buffer.from(expectedToken)
  const actualBuffer = Buffer.from(actualToken)

  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, actualBuffer)
}

/**
 * Resolves an application user from a bearer token backed by USERTOKEN_* environment variables.
 * Scope: API v1 authentication.
 */
async function getUserFromApiToken(token: string): Promise<User | undefined> {
  const usersData = await loadUsersDataFromStore()
  const defaultAdminToken = process.env.API_ADMIN_TOKEN?.trim()

  if (defaultAdminToken && tokensMatch(defaultAdminToken, token)) {
    return usersData.users.find((user) => user.isAdmin)
  }

  const usersByUsername = new Map(
    usersData.users.map((user) => [user.username.toLowerCase(), user])
  )
  const environmentEntries = Object.entries(process.env as Record<string, string | undefined>)

  for (const [environmentKey, environmentValue] of environmentEntries) {
    if (!environmentValue || !environmentKey.toUpperCase().startsWith('USERTOKEN_')) {
      continue
    }

    if (!tokensMatch(environmentValue, token)) {
      continue
    }

    const username = environmentKey.slice('USERTOKEN_'.length).trim().toLowerCase()
    if (!username) {
      continue
    }

    return usersByUsername.get(username)
  }

  return undefined
}

/**
 * Resolves the current request user ID from bearer-token auth first, then session auth.
 * Scope: shared authentication across API routes and server actions.
 */
export async function getCurrentUserId(): Promise<UserId | undefined> {
  const requestHeaders = await getRequestHeaders()
  const bearerToken = getBearerToken(requestHeaders)

  if (bearerToken) {
    const tokenUser = await getUserFromApiToken(bearerToken)
    return tokenUser?.id
  }

  const session = await auth()
  const user = session?.user
  return user?.id
}

/**
 * Resolves the current authenticated user from bearer-token auth first, then session auth.
 * Scope: shared server-side authorization checks and data filtering.
 */
export async function getCurrentUser(): Promise<User | undefined> {
  const requestHeaders = await getRequestHeaders()
  const bearerToken = getBearerToken(requestHeaders)

  if (bearerToken) {
    return getUserFromApiToken(bearerToken)
  }

  const currentUserId = await getCurrentUserId()
  if (!currentUserId) {
    return undefined
  }
  const usersData = await loadUsersDataFromStore()
  return usersData.users.find((u) => u.id === currentUserId)
}

/**
 * Hashes a plaintext password with scrypt and a random or provided salt.
 * Scope: user password storage and verification.
 */
export function saltAndHashPassword(password: string, salt?: string): string {
  if (password.length === 0) throw new Error('Password must not be empty')
  salt = salt || randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/**
 * Verifies a plaintext password against a stored salt:hash value.
 * Scope: sign-in credential validation.
 */
export function verifyPassword(password?: string, storedHash?: string): boolean {
  // if both password and storedHash is undefined, return true
  if (!password && !storedHash) return true
  // else if either password or storedHash is undefined, return false
  if (!password || !storedHash) return false

  // Split the stored hash into its salt and hash components
  const [salt, hash] = storedHash.split(':')
  // Hash the input password with the same salt
  const newHash = saltAndHashPassword(password, salt).split(':')[1]
  // Compare the new hash with the stored hash
  return newHash === hash
}
