import { loadUsersPublicData } from '@/app/actions/data'
import { getCurrentUser } from '@/lib/server-helpers'
import { CoinsData, HabitsData, User, WishlistData } from '@/lib/types'
import { checkPermission } from '@/lib/utils'
import { NextResponse } from 'next/server'

/**
 * Represents an API error that should be serialized into the shared response envelope.
 * Scope: API v1 route handlers and shared helpers.
 */
export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export type ApiRouteContext = {
  request: Request
  user: User
}

/**
 * Serializes a successful API response into the shared envelope format.
 * Scope: API v1 route handlers.
 */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status })
}

/**
 * Serializes an API error into the shared envelope format.
 * Scope: API v1 route handlers and shared helpers.
 */
export function fail(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.status }
    )
  }

  console.error('Unhandled API error:', error)
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'internal_error',
        message: 'Internal server error',
      },
    },
    { status: 500 }
  )
}

/**
 * Wraps an authenticated API route with shared bearer/session auth and error handling.
 * Scope: API v1 route handlers.
 */
export async function withApiRoute(
  request: Request,
  handler: (context: ApiRouteContext) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser()

    if (!user) {
      throw new ApiError(401, 'unauthorized', 'A valid bearer token is required.')
    }

    return await handler({ request, user })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Parses a JSON request body and converts malformed payloads into API errors.
 * Scope: API v1 route handlers.
 */
export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
}

/**
 * Parses an optional JSON request body and returns an empty object when no body is present.
 * Scope: API v1 action endpoints with optional payload fields.
 */
export async function parseOptionalJsonBody<T>(request: Request): Promise<Partial<T>> {
  try {
    const bodyText = await request.text()

    if (bodyText.trim() === '') {
      return {}
    }

    return JSON.parse(bodyText) as Partial<T>
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON when provided.')
  }
}

/**
 * Resolves the initial list limit from a request, clamped to the v1 range of 1-100.
 * Scope: API v1 list endpoints.
 */
export function getListLimit(request: Request): number {
  const url = new URL(request.url)
  const rawLimit = url.searchParams.get('limit')
  const parsedLimit = Number.parseInt(rawLimit ?? '100', 10)

  if (Number.isNaN(parsedLimit)) {
    return 100
  }

  if (parsedLimit < 1) {
    return 1
  }

  return Math.min(parsedLimit, 100)
}

/**
 * Returns the optional userId query parameter for admin-targeted endpoints.
 * Scope: API v1 routes that can operate on another user.
 */
export function getRequestedUserId(request: Request): string | undefined {
  const url = new URL(request.url)
  return url.searchParams.get('userId') ?? undefined
}

/**
 * Ensures the current user has the required app permission for a resource action.
 * Scope: API v1 routes that mirror UI authorization behavior.
 */
export function requirePermission(
  user: User,
  resource: 'habit' | 'wishlist' | 'coins',
  action: 'write' | 'interact'
): void {
  if (user.isAdmin) {
    return
  }

  if (!checkPermission(user.permissions, resource, action)) {
    throw new ApiError(403, 'forbidden', 'You do not have permission to access this resource.')
  }
}

/**
 * Ensures the current user is an admin.
 * Scope: admin-only API routes.
 */
export function requireAdmin(user: User): void {
  if (!user.isAdmin) {
    throw new ApiError(403, 'forbidden', 'Administrator access is required for this endpoint.')
  }
}

/**
 * Validates an optional target userId against API rules and returns the effective target.
 * Scope: API v1 endpoints that support admin targeting.
 */
export async function resolveTargetUserId(
  user: User,
  requestedUserId?: string
): Promise<string | undefined> {
  if (!requestedUserId) {
    return undefined
  }

  if (!user.isAdmin && requestedUserId !== user.id) {
    throw new ApiError(403, 'forbidden', 'You cannot target another user.')
  }

  const usersData = await loadUsersPublicData()
  const targetExists = usersData.users.some((candidateUser) => candidateUser.id === requestedUserId)

  if (!targetExists) {
    throw new ApiError(404, 'user_not_found', 'The requested user was not found.')
  }

  return requestedUserId
}

/**
 * Validates and normalizes shared-owner user IDs for habit and wishlist payloads.
 * Scope: API v1 create and update routes.
 */
export async function normalizeOwnedUserIds(
  user: User,
  requestedUserId?: string,
  requestedUserIds?: unknown
): Promise<string[]> {
  if (!user.isAdmin) {
    return [user.id]
  }

  const candidateUserIds = Array.isArray(requestedUserIds)
    ? requestedUserIds.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    : requestedUserId
      ? [requestedUserId]
      : [user.id]

  const normalizedUserIds = [...new Set(candidateUserIds)]
  const usersData = await loadUsersPublicData()
  const knownUserIds = new Set(usersData.users.map((candidateUser) => candidateUser.id))
  const unknownUserIds = normalizedUserIds.filter((candidateUserId) => !knownUserIds.has(candidateUserId))

  if (unknownUserIds.length > 0) {
    throw new ApiError(404, 'user_not_found', 'One or more referenced users were not found.')
  }

  return normalizedUserIds
}

/**
 * Filters a habits payload to a specific target user when one is requested.
 * Scope: admin-targeted API reads.
 */
export function filterHabitsByUserId(habitsData: HabitsData, targetUserId?: string): HabitsData {
  if (!targetUserId) {
    return habitsData
  }

  return {
    ...habitsData,
    habits: habitsData.habits.filter((habit) => habit.userIds?.includes(targetUserId)),
  }
}

/**
 * Filters a wishlist payload to a specific target user when one is requested.
 * Scope: admin-targeted API reads.
 */
export function filterWishlistByUserId(wishlistData: WishlistData, targetUserId?: string): WishlistData {
  if (!targetUserId) {
    return wishlistData
  }

  return {
    ...wishlistData,
    items: wishlistData.items.filter((item) => item.userIds?.includes(targetUserId)),
  }
}

/**
 * Filters a coins payload to a specific target user and recomputes the balance if needed.
 * Scope: admin-targeted API reads.
 */
export function filterCoinsByUserId(coinsData: CoinsData, targetUserId?: string): CoinsData {
  if (!targetUserId) {
    return coinsData
  }

  const transactions = coinsData.transactions.filter((transaction) => transaction.userId === targetUserId)
  const balance = transactions.reduce((sum, transaction) => sum + transaction.amount, 0)

  return {
    balance,
    transactions,
  }
}

/**
 * Applies the v1 collection limit while preserving the endpoint's existing sort order.
 * Scope: API v1 list endpoints.
 */
export function limitItems<T>(items: T[], limit: number): T[] {
  return items.slice(0, limit)
}

/**
 * Ensures a string field is present and non-empty.
 * Scope: simple API payload validation.
 */
export function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(400, 'invalid_request', `${fieldName} must be a non-empty string.`)
  }

  return value
}

/**
 * Ensures a numeric field is present and finite.
 * Scope: simple API payload validation.
 */
export function requireNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError(400, 'invalid_request', `${fieldName} must be a finite number.`)
  }

  return value
}

/**
 * Ensures a boolean field is present when supplied.
 * Scope: simple API payload validation.
 */
export function requireOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (typeof value === 'undefined') {
    return undefined
  }

  if (typeof value !== 'boolean') {
    throw new ApiError(400, 'invalid_request', `${fieldName} must be a boolean when provided.`)
  }

  return value
}

/**
 * Ensures an array field only contains strings when supplied.
 * Scope: simple API payload validation.
 */
export function requireOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (typeof value === 'undefined') {
    return undefined
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new ApiError(400, 'invalid_request', `${fieldName} must be an array of strings when provided.`)
  }

  return value
}