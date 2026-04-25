import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { NextResponse } from 'next/server'

const mockLoadUsersPublicData = mock()
const mockGetCurrentUser = mock()
const mockAuth = mock()
const mockAddCoins = mock()
const mockGetUser = mock()
const mockLoadCoinsData = mock()
const mockRemoveCoins = mock()
const mockSaveHabitsData = mock()
const mockSaveWishlistItems = mock()

mock.module('@/app/actions/data', () => ({
  addCoins: mockAddCoins,
  getUser: mockGetUser,
  loadCoinsData: mockLoadCoinsData,
  loadHabitsData: mock(),
  loadSettings: mock(),
  loadUsersPublicData: mockLoadUsersPublicData,
  loadWishlistData: mock(),
  removeCoins: mockRemoveCoins,
  saveCoinsData: mock(),
  saveHabitsData: mockSaveHabitsData,
  saveSettings: mock(),
  saveWishlistItems: mockSaveWishlistItems,
}))

mock.module('@/auth', () => ({
  auth: mockAuth,
}))

mock.module('@/lib/server-helpers', () => ({
  getCurrentUser: mockGetCurrentUser,
}))

let ApiError: typeof import('./index').ApiError
let fail: typeof import('./index').fail
let filterCoinsByUserId: typeof import('./index').filterCoinsByUserId
let filterHabitsByUserId: typeof import('./index').filterHabitsByUserId
let filterWishlistByUserId: typeof import('./index').filterWishlistByUserId
let getListLimit: typeof import('./index').getListLimit
let limitItems: typeof import('./index').limitItems
let normalizeOwnedUserIds: typeof import('./index').normalizeOwnedUserIds
let parseOptionalJsonBody: typeof import('./index').parseOptionalJsonBody
let requireNumber: typeof import('./index').requireNumber
let requireOptionalBoolean: typeof import('./index').requireOptionalBoolean
let requirePermission: typeof import('./index').requirePermission
let requireString: typeof import('./index').requireString
let resolveTargetUserId: typeof import('./index').resolveTargetUserId
let withApiRoute: typeof import('./index').withApiRoute

beforeAll(async () => {
  ({
    ApiError,
    fail,
    filterCoinsByUserId,
    filterHabitsByUserId,
    filterWishlistByUserId,
    getListLimit,
    limitItems,
    normalizeOwnedUserIds,
    parseOptionalJsonBody,
    requireNumber,
    requireOptionalBoolean,
    requirePermission,
    requireString,
    resolveTargetUserId,
    withApiRoute,
  } = await import('./index'))
})

afterEach(() => {
  mock.restore()
})

describe('utils/api/index', () => {
  beforeEach(() => {
    mockAddCoins.mockReset()
    mockAuth.mockReset()
    mockGetUser.mockReset()
    mockLoadCoinsData.mockReset()
    mockLoadUsersPublicData.mockReset()
    mockGetCurrentUser.mockReset()
    mockRemoveCoins.mockReset()
    mockSaveHabitsData.mockReset()
    mockSaveWishlistItems.mockReset()
  })

  test('clamps list limits to the v1 range', () => {
    expect(getListLimit(new Request('http://localhost:3000/api/v1/habits'))).toBe(100)
    expect(getListLimit(new Request('http://localhost:3000/api/v1/habits?limit=999'))).toBe(100)
    expect(getListLimit(new Request('http://localhost:3000/api/v1/habits?limit=0'))).toBe(1)
  })

  test('parses optional JSON bodies and handles empty bodies', async () => {
    expect(await parseOptionalJsonBody<{ userId?: string }>(new Request('http://localhost', { method: 'POST' }))).toEqual({})
    expect(await parseOptionalJsonBody<{ userId?: string }>(new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'u1' }) }))).toEqual({ userId: 'u1' })
  })

  test('resolves and validates target users for admin targeting', async () => {
    mockLoadUsersPublicData.mockResolvedValue({ users: [{ id: 'u1', username: 'alpha', isAdmin: false, hasPassword: true }] })

    await expect(resolveTargetUserId({ id: 'admin', username: 'admin', isAdmin: true } as never, 'u1')).resolves.toBe('u1')
    await expect(resolveTargetUserId({ id: 'user', username: 'alpha', isAdmin: false } as never, 'u1')).rejects.toMatchObject({ code: 'forbidden' })
  })

  test('normalizes owner lists for admins and non-admins', async () => {
    mockLoadUsersPublicData.mockResolvedValue({ users: [{ id: 'u1', username: 'alpha', isAdmin: false, hasPassword: true }, { id: 'u2', username: 'beta', isAdmin: false, hasPassword: true }] })

    await expect(normalizeOwnedUserIds({ id: 'user', username: 'alpha', isAdmin: false } as never, undefined, ['u2'])).resolves.toEqual(['user'])
    await expect(normalizeOwnedUserIds({ id: 'admin', username: 'admin', isAdmin: true } as never, undefined, ['u1', 'u2', 'u1'])).resolves.toEqual(['u1', 'u2'])
  })

  test('filters collection payloads by user', () => {
    expect(filterHabitsByUserId({ habits: [{ id: 'h1', userIds: ['u1'] } as never, { id: 'h2', userIds: ['u2'] } as never] }, 'u2')).toEqual({ habits: [{ id: 'h2', userIds: ['u2'] } as never] })
    expect(filterWishlistByUserId({ items: [{ id: 'w1', userIds: ['u1'] } as never] }, 'u1')).toEqual({ items: [{ id: 'w1', userIds: ['u1'] } as never] })
    expect(filterCoinsByUserId({ balance: 99, transactions: [{ id: 't1', amount: 5, userId: 'u1' } as never, { id: 't2', amount: -2, userId: 'u2' } as never] }, 'u1')).toEqual({ balance: 5, transactions: [{ id: 't1', amount: 5, userId: 'u1' } as never] })
  })

  test('validates primitive request fields and permissions', () => {
    expect(requireString('value', 'field')).toBe('value')
    expect(requireNumber(3, 'field')).toBe(3)
    expect(requireOptionalBoolean(true, 'field')).toBe(true)
    expect(() => requirePermission({ id: 'u1', username: 'alpha', isAdmin: false, permissions: [] } as never, 'coins', 'write')).toThrow()
    expect(() => requireString('', 'field')).toThrow()
  })

  test('limits arrays and serializes API errors', async () => {
    expect(limitItems([1, 2, 3], 2)).toEqual([1, 2])
    const response = fail(new ApiError(404, 'missing', 'Not found'))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ ok: false, error: { code: 'missing', message: 'Not found' } })
  })

  test('wraps authenticated handlers with shared auth and error handling', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', username: 'alpha', isAdmin: false, permissions: [] })
    const response = await withApiRoute(new Request('http://localhost'), async ({ user }) => NextResponse.json({ id: user.id }, { status: 200 }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'u1' })
  })
})