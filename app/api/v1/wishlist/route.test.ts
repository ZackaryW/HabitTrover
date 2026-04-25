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
const mockCompleteHabitForApi = mock()
const mockRedeemWishlistItemForApi = mock()
const mockUndoLatestHabitCompletionForApi = mock()

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
mock.module('@/utils/api/domain', async () => {
  return {
    completeHabitForApi: mockCompleteHabitForApi,
    redeemWishlistItemForApi: mockRedeemWishlistItemForApi,
    undoLatestHabitCompletionForApi: mockUndoLatestHabitCompletionForApi,
  }
})

let GET_COLLECTION: typeof import('./route').GET
let POST_COLLECTION: typeof import('./route').POST
let PATCH_ITEM: typeof import('./[id]/route').PATCH
let DELETE_ITEM: typeof import('./[id]/route').DELETE
let POST_REDEEM: typeof import('./[id]/redeem/route').POST
let POST_ARCHIVE: typeof import('./[id]/archive/route').POST
let POST_UNARCHIVE: typeof import('./[id]/unarchive/route').POST

beforeAll(async () => {
  ;({ GET: GET_COLLECTION, POST: POST_COLLECTION } = await import('./route'))
  ;({ PATCH: PATCH_ITEM, DELETE: DELETE_ITEM } = await import('./[id]/route'))
  ;({ POST: POST_REDEEM } = await import('./[id]/redeem/route'))
  ;({ POST: POST_ARCHIVE } = await import('./[id]/archive/route'))
  ;({ POST: POST_UNARCHIVE } = await import('./[id]/unarchive/route'))
})

afterEach(() => { mock.restore() })

describe('API v1 wishlist routes', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset(); mockAddCoins.mockReset(); mockLoadCoinsData.mockReset(); mockLoadHabitsData.mockReset(); mockLoadSettings.mockReset(); mockLoadUsersPublicData.mockReset(); mockLoadWishlistData.mockReset(); mockRemoveCoins.mockReset(); mockSaveCoinsData.mockReset(); mockSaveHabitsData.mockReset(); mockSaveSettings.mockReset(); mockSaveWishlistItems.mockReset(); mockCompleteHabitForApi.mockReset(); mockRedeemWishlistItemForApi.mockReset(); mockUndoLatestHabitCompletionForApi.mockReset()
  })

  test('lists wishlist items with a limit', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', username: 'alice', isAdmin: false, permissions: [] })
    mockLoadWishlistData.mockResolvedValue({ items: [{ id: 'w1', name: 'Movie', description: '', coinCost: 10, userIds: ['user-1'] }, { id: 'w2', name: 'Game', description: '', coinCost: 20, userIds: ['user-1'] }] })

    const response = await GET_COLLECTION(new Request('http://localhost:3000/api/v1/wishlist?limit=1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { items: [{ id: 'w1', name: 'Movie', description: '', coinCost: 10, userIds: ['user-1'] }], limit: 1 } })
  })

  test('creates a wishlist item', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', username: 'alice', isAdmin: false, permissions: [{ habit: { write: false, interact: false }, wishlist: { write: true, interact: true }, coins: { write: false, interact: false } }] })
    mockLoadWishlistData.mockResolvedValue({ items: [] })
    mockSaveWishlistItems.mockResolvedValue(undefined)

    const response = await POST_COLLECTION(new Request('http://localhost:3000/api/v1/wishlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Movie', coinCost: 10 }) }))

    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.item).toMatchObject({ name: 'Movie', coinCost: 10, userIds: ['user-1'] })
  })

  test('updates a wishlist item', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', username: 'alice', isAdmin: false, permissions: [{ habit: { write: false, interact: false }, wishlist: { write: true, interact: true }, coins: { write: false, interact: false } }] })
    mockLoadWishlistData.mockResolvedValue({ items: [{ id: 'w1', name: 'Movie', description: '', coinCost: 10, userIds: ['user-1'] }] })
    mockSaveWishlistItems.mockResolvedValue(undefined)

    const response = await PATCH_ITEM(new Request('http://localhost:3000/api/v1/wishlist/w1', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ link: 'https://example.com' }) }), { params: Promise.resolve({ id: 'w1' }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { item: { id: 'w1', name: 'Movie', description: '', coinCost: 10, link: 'https://example.com', userIds: ['user-1'] } } })
  })

  test('deletes a wishlist item', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', username: 'alice', isAdmin: false, permissions: [{ habit: { write: false, interact: false }, wishlist: { write: true, interact: true }, coins: { write: false, interact: false } }] })
    mockLoadWishlistData.mockResolvedValue({ items: [{ id: 'w1', name: 'Movie', description: '', coinCost: 10, userIds: ['user-1'] }] })
    mockSaveWishlistItems.mockResolvedValue(undefined)

    const response = await DELETE_ITEM(new Request('http://localhost:3000/api/v1/wishlist/w1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'w1' }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { deleted: true } })
  })

  test('redeems a wishlist item for the targeted user', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', username: 'admin', isAdmin: true, permissions: [] })
    mockLoadUsersPublicData.mockResolvedValue({ users: [{ id: 'user-1', username: 'alice', isAdmin: false, hasPassword: true }] })
    mockLoadWishlistData.mockResolvedValue({ items: [{ id: 'w1', name: 'Movie', description: '', coinCost: 10, userIds: ['user-1'] }] })
    mockLoadCoinsData.mockResolvedValue({ balance: 10, transactions: [{ id: 't1', amount: 10, description: 'Bonus', timestamp: '2026-04-24T00:00:00.000Z', type: 'MANUAL_ADJUSTMENT', userId: 'user-1' }] })
    mockRedeemWishlistItemForApi.mockResolvedValue({ item: { id: 'w1', name: 'Movie', description: '', coinCost: 10, userIds: ['user-1'] }, coins: { balance: 0, transactions: [{ id: 't2', amount: -10, description: 'Redeemed reward: Movie', timestamp: '2026-04-24T01:00:00.000Z', type: 'WISH_REDEMPTION', userId: 'user-1' }] }, wishlist: { items: [] } })

    const response = await POST_REDEEM(new Request('http://localhost:3000/api/v1/wishlist/w1/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'user-1' }) }), { params: Promise.resolve({ id: 'w1' }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { item: { id: 'w1', name: 'Movie', description: '', coinCost: 10, userIds: ['user-1'] }, coins: { balance: -10, transactions: [{ id: 't2', amount: -10, description: 'Redeemed reward: Movie', timestamp: '2026-04-24T01:00:00.000Z', type: 'WISH_REDEMPTION', userId: 'user-1' }] } } })
  })

  test('archives and unarchives a wishlist item', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', username: 'alice', isAdmin: false, permissions: [{ habit: { write: false, interact: false }, wishlist: { write: true, interact: true }, coins: { write: false, interact: false } }] })
    mockLoadWishlistData.mockResolvedValue({ items: [{ id: 'w1', name: 'Movie', description: '', coinCost: 10, archived: false, userIds: ['user-1'] }] })
    mockSaveWishlistItems.mockResolvedValue(undefined)

    const archiveResponse = await POST_ARCHIVE(new Request('http://localhost:3000/api/v1/wishlist/w1/archive', { method: 'POST' }), { params: Promise.resolve({ id: 'w1' }) })
    expect(archiveResponse.status).toBe(200)

    mockLoadWishlistData.mockResolvedValue({ items: [{ id: 'w1', name: 'Movie', description: '', coinCost: 10, archived: true, userIds: ['user-1'] }] })
    const unarchiveResponse = await POST_UNARCHIVE(new Request('http://localhost:3000/api/v1/wishlist/w1/unarchive', { method: 'POST' }), { params: Promise.resolve({ id: 'w1' }) })
    expect(unarchiveResponse.status).toBe(200)
  })
})