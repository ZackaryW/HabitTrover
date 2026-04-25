import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'

const mockGetCurrentUser = mock()
const mockAddCoins = mock()
const mockLoadCoinsData = mock()
const mockLoadHabitsData = mock()
const mockLoadSettings = mock()
const mockLoadUsersPublicData = mock()
const mockLoadWishlistData = mock()
const mockRemoveCoins = mock()
const mockSaveCoinsData = mock()
const mockSaveHabitsData = mock()
const mockSaveSettings = mock()
const mockSaveWishlistItems = mock()

mock.module('@/lib/server-helpers', () => ({ getCurrentUser: mockGetCurrentUser }))
mock.module('@/app/actions/data', () => ({
  addCoins: mockAddCoins,
  getUser: mock(),
  loadCoinsData: mockLoadCoinsData,
  loadHabitsData: mockLoadHabitsData,
  loadSettings: mockLoadSettings,
  loadUsersPublicData: mockLoadUsersPublicData,
  loadWishlistData: mockLoadWishlistData,
  removeCoins: mockRemoveCoins,
  saveCoinsData: mockSaveCoinsData,
  saveHabitsData: mockSaveHabitsData,
  saveSettings: mockSaveSettings,
  saveWishlistItems: mockSaveWishlistItems,
}))

let GET_SUMMARY: typeof import('./route').GET
let GET_TRANSACTIONS: typeof import('./transactions/route').GET
let POST_REMOVE: typeof import('./remove/route').POST
let PATCH_TRANSACTION: typeof import('./transactions/[id]/route').PATCH

beforeAll(async () => {
  ;({ GET: GET_SUMMARY } = await import('./route'))
  ;({ GET: GET_TRANSACTIONS } = await import('./transactions/route'))
  ;({ POST: POST_REMOVE } = await import('./remove/route'))
  ;({ PATCH: PATCH_TRANSACTION } = await import('./transactions/[id]/route'))
})

afterEach(() => { mock.restore() })

describe('API v1 coins routes', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset(); mockAddCoins.mockReset(); mockLoadCoinsData.mockReset(); mockLoadHabitsData.mockReset(); mockLoadSettings.mockReset(); mockLoadUsersPublicData.mockReset(); mockLoadWishlistData.mockReset(); mockRemoveCoins.mockReset(); mockSaveCoinsData.mockReset(); mockSaveHabitsData.mockReset(); mockSaveSettings.mockReset(); mockSaveWishlistItems.mockReset()
  })

  test('returns a filtered coin summary for admin user targeting', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', username: 'admin', isAdmin: true, permissions: [] })
    mockLoadUsersPublicData.mockResolvedValue({ users: [{ id: 'user-2', username: 'bob', isAdmin: false, hasPassword: true }] })
    mockLoadCoinsData.mockResolvedValue({ balance: 10, transactions: [{ id: 't1', amount: 2, description: 'A', timestamp: '2026-04-24T00:00:00.000Z', type: 'MANUAL_ADJUSTMENT', userId: 'user-2' }] })

    const response = await GET_SUMMARY(new Request('http://localhost:3000/api/v1/coins?userId=user-2'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { coins: { balance: 2, transactions: [{ id: 't1', amount: 2, description: 'A', timestamp: '2026-04-24T00:00:00.000Z', type: 'MANUAL_ADJUSTMENT', userId: 'user-2' }] } } })
  })

  test('returns the latest transactions with a limit', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', username: 'alice', isAdmin: false, permissions: [] })
    mockLoadCoinsData.mockResolvedValue({ balance: 3, transactions: [{ id: 't1', amount: 2, description: 'A', timestamp: '2026-04-24T00:00:00.000Z', type: 'MANUAL_ADJUSTMENT', userId: 'user-1' }, { id: 't2', amount: 1, description: 'B', timestamp: '2026-04-24T01:00:00.000Z', type: 'MANUAL_ADJUSTMENT', userId: 'user-1' }] })

    const response = await GET_TRANSACTIONS(new Request('http://localhost:3000/api/v1/coins/transactions?limit=1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { transactions: [{ id: 't1', amount: 2, description: 'A', timestamp: '2026-04-24T00:00:00.000Z', type: 'MANUAL_ADJUSTMENT', userId: 'user-1' }], limit: 1 } })
  })

  test('rejects non-positive coin removals', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', username: 'alice', isAdmin: false, permissions: [{ habit: { write: false, interact: false }, wishlist: { write: false, interact: false }, coins: { write: true, interact: true } }] })

    const response = await POST_REMOVE(new Request('http://localhost:3000/api/v1/coins/remove', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amount: 0, description: 'Bad' }) }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: { code: 'invalid_request', message: 'amount must be greater than zero.' } })
  })

  test('updates a transaction note', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', username: 'alice', isAdmin: false, permissions: [{ habit: { write: false, interact: false }, wishlist: { write: false, interact: false }, coins: { write: true, interact: true } }] })
    mockLoadCoinsData.mockResolvedValue({ balance: 2, transactions: [{ id: 't1', amount: 2, description: 'A', timestamp: '2026-04-24T00:00:00.000Z', type: 'MANUAL_ADJUSTMENT', userId: 'user-1' }] })
    mockSaveCoinsData.mockResolvedValue(undefined)

    const response = await PATCH_TRANSACTION(new Request('http://localhost:3000/api/v1/coins/transactions/t1', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note: ' hello ' }) }), { params: Promise.resolve({ id: 't1' }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { transaction: { id: 't1', amount: 2, description: 'A', timestamp: '2026-04-24T00:00:00.000Z', type: 'MANUAL_ADJUSTMENT', userId: 'user-1', note: 'hello' } } })
  })
})