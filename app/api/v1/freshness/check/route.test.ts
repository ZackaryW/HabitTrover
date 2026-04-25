import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { Settings } from '@/lib/types'
import { generateCryptoHash, prepareDataForHashing } from '@/lib/utils'

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

let POST: typeof import('./route').POST

beforeAll(async () => {
  ;({ POST } = await import('./route'))
})

afterEach(() => { mock.restore() })

describe('POST /api/v1/freshness/check', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset(); mockAddCoins.mockReset(); mockLoadCoinsData.mockReset(); mockLoadHabitsData.mockReset(); mockLoadSettings.mockReset(); mockLoadUsersPublicData.mockReset(); mockLoadWishlistData.mockReset(); mockRemoveCoins.mockReset(); mockSaveCoinsData.mockReset(); mockSaveHabitsData.mockReset(); mockSaveSettings.mockReset(); mockSaveWishlistItems.mockReset()
  })

  test('blocks non-admin requests that include users', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', username: 'alice', isAdmin: false, permissions: [] })

    const response = await POST(new Request('http://localhost:3000/api/v1/freshness/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientToken: 'abc', includeUsers: true }) }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ ok: false, error: { code: 'forbidden', message: 'Only administrators can include users in freshness checks.' } })
  })

  test('returns freshness comparison data', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', username: 'admin', isAdmin: true, permissions: [] })
    const settings: Settings = { ui: { useNumberFormatting: true, useGrouping: true }, system: { timezone: 'UTC', weekStartDay: 1, autoBackupEnabled: true, language: 'en' }, profile: {} }
    const habits = { habits: [] }
    const coins = { balance: 0, transactions: [] }
    const wishlist = { items: [] }
    const users = { users: [{ id: 'admin-1', username: 'admin', isAdmin: true, hasPassword: true }] }
    const clientToken = await generateCryptoHash(prepareDataForHashing(settings, habits, coins, wishlist, users))

    mockLoadSettings.mockResolvedValue(settings)
    mockLoadHabitsData.mockResolvedValue({ habits: [] })
    mockLoadCoinsData.mockResolvedValue({ balance: 0, transactions: [] })
    mockLoadWishlistData.mockResolvedValue({ items: [] })
    mockLoadUsersPublicData.mockResolvedValue(users)

    const response = await POST(new Request('http://localhost:3000/api/v1/freshness/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientToken, includeUsers: true }) }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { isFresh: true, serverToken: clientToken } })
  })
})