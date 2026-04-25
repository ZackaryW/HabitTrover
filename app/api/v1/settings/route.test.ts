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

let GET: typeof import('./route').GET
let PATCH: typeof import('./route').PATCH

beforeAll(async () => {
  ;({ GET, PATCH } = await import('./route'))
})

afterEach(() => { mock.restore() })

describe('API v1 settings route', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset(); mockAddCoins.mockReset(); mockLoadCoinsData.mockReset(); mockLoadHabitsData.mockReset(); mockLoadSettings.mockReset(); mockLoadUsersPublicData.mockReset(); mockLoadWishlistData.mockReset(); mockRemoveCoins.mockReset(); mockSaveCoinsData.mockReset(); mockSaveHabitsData.mockReset(); mockSaveSettings.mockReset(); mockSaveWishlistItems.mockReset()
  })

  test('returns settings for an authenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', username: 'alice', isAdmin: false, permissions: [] })
    mockLoadSettings.mockResolvedValue({ ui: { useNumberFormatting: true, useGrouping: true }, system: { timezone: 'UTC', weekStartDay: 1, autoBackupEnabled: true, language: 'en' }, profile: {} })

    const response = await GET(new Request('http://localhost:3000/api/v1/settings'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { settings: { ui: { useNumberFormatting: true, useGrouping: true }, system: { timezone: 'UTC', weekStartDay: 1, autoBackupEnabled: true, language: 'en' }, profile: {} } } })
  })

  test('patches settings deeply', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', username: 'alice', isAdmin: false, permissions: [] })
    mockLoadSettings.mockResolvedValue({ ui: { useNumberFormatting: true, useGrouping: true }, system: { timezone: 'UTC', weekStartDay: 1, autoBackupEnabled: true, language: 'en' }, profile: {} })
    mockSaveSettings.mockResolvedValue(undefined)

    const response = await PATCH(new Request('http://localhost:3000/api/v1/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ system: { language: 'fr' } }) }))

    expect(response.status).toBe(200)
    expect(mockSaveSettings).toHaveBeenCalledWith({ ui: { useNumberFormatting: true, useGrouping: true }, system: { timezone: 'UTC', weekStartDay: 1, autoBackupEnabled: true, language: 'fr' }, profile: {} })
  })
})