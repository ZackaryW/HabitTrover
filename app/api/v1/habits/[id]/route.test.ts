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

mock.module('@/lib/server-helpers', () => ({
  getCurrentUser: mockGetCurrentUser,
}))

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

let PATCH: typeof import('./route').PATCH
let DELETE: typeof import('./route').DELETE

beforeAll(async () => {
  ;({ PATCH, DELETE } = await import('./route'))
})

afterEach(() => {
  mock.restore()
})

describe('API v1 habit item route', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset()
    mockAddCoins.mockReset()
    mockLoadCoinsData.mockReset()
    mockLoadHabitsData.mockReset()
    mockLoadSettings.mockReset()
    mockLoadUsersPublicData.mockReset()
    mockLoadWishlistData.mockReset()
    mockRemoveCoins.mockReset()
    mockSaveCoinsData.mockReset()
    mockSaveHabitsData.mockReset()
    mockSaveSettings.mockReset()
    mockSaveWishlistItems.mockReset()
  })

  test('updates an owned habit', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      isAdmin: false,
      permissions: [{
        habit: { write: true, interact: true },
        wishlist: { write: false, interact: false },
        coins: { write: false, interact: false },
      }],
    })
    mockLoadHabitsData.mockResolvedValue({
      habits: [{ id: 'habit-1', name: 'Read', description: '', frequency: 'daily', coinReward: 1, completions: [], userIds: ['user-1'] }],
    })
    mockSaveHabitsData.mockResolvedValue(undefined)

    const response = await PATCH(new Request('http://localhost:3000/api/v1/habits/habit-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Read More', drawing: null }),
    }), { params: Promise.resolve({ id: 'habit-1' }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        habit: { id: 'habit-1', name: 'Read More', description: '', frequency: 'daily', coinReward: 1, completions: [], drawing: undefined, userIds: ['user-1'] },
      },
    })
  })

  test('rejects updates to a habit owned by another user', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      isAdmin: false,
      permissions: [{
        habit: { write: true, interact: true },
        wishlist: { write: false, interact: false },
        coins: { write: false, interact: false },
      }],
    })
    mockLoadHabitsData.mockResolvedValue({
      habits: [{ id: 'habit-1', name: 'Read', description: '', frequency: 'daily', coinReward: 1, completions: [], userIds: ['user-2'] }],
    })

    const response = await PATCH(new Request('http://localhost:3000/api/v1/habits/habit-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Read More' }),
    }), { params: Promise.resolve({ id: 'habit-1' }) })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: 'forbidden', message: 'You cannot update this habit.' },
    })
  })

  test('deletes an owned habit', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      isAdmin: false,
      permissions: [{
        habit: { write: true, interact: true },
        wishlist: { write: false, interact: false },
        coins: { write: false, interact: false },
      }],
    })
    mockLoadHabitsData.mockResolvedValue({
      habits: [{ id: 'habit-1', name: 'Read', description: '', frequency: 'daily', coinReward: 1, completions: [], userIds: ['user-1'] }],
    })
    mockSaveHabitsData.mockResolvedValue(undefined)

    const response = await DELETE(new Request('http://localhost:3000/api/v1/habits/habit-1', {
      method: 'DELETE',
    }), { params: Promise.resolve({ id: 'habit-1' }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { deleted: true } })
    expect(mockSaveHabitsData).toHaveBeenCalledWith({ habits: [] })
  })
})