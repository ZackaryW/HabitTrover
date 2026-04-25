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

mock.module('@/utils/api/domain', () => ({
  completeHabitForApi: mockCompleteHabitForApi,
}))

let POST: typeof import('./route').POST

beforeAll(async () => {
  ;({ POST } = await import('./route'))
})

afterEach(() => {
  mock.restore()
})

describe('POST /api/v1/habits/[id]/complete', () => {
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
    mockCompleteHabitForApi.mockReset()
  })

  test('completes a visible habit with an empty body', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1', username: 'alice', isAdmin: false,
      permissions: [{ habit: { write: true, interact: true }, wishlist: { write: false, interact: false }, coins: { write: false, interact: false } }],
    })
    mockLoadSettings.mockResolvedValue({ ui: {}, system: { timezone: 'UTC' }, profile: {} })
    mockLoadHabitsData.mockResolvedValue({ habits: [{ id: 'habit-1', name: 'Read', description: '', frequency: 'daily', coinReward: 1, completions: [], userIds: ['user-1'] }] })
    mockCompleteHabitForApi.mockResolvedValue({
      habit: { id: 'habit-1', name: 'Read', description: '', frequency: 'daily', coinReward: 1, completions: ['2026-04-24T00:00:00.000Z'], userIds: ['user-1'] },
      coins: { balance: 1, transactions: [] },
      undoDepth: 1,
    })

    const response = await POST(new Request('http://localhost:3000/api/v1/habits/habit-1/complete', { method: 'POST' }), { params: Promise.resolve({ id: 'habit-1' }) })

    expect(response.status).toBe(200)
    expect(mockCompleteHabitForApi).toHaveBeenCalledWith({ habitsData: { habits: [{ id: 'habit-1', name: 'Read', description: '', frequency: 'daily', coinReward: 1, completions: [], userIds: ['user-1'] }] }, habitId: 'habit-1', timezone: 'UTC', coinUserId: undefined })
  })

  test('returns 404 when the habit is not owned by the targeted user', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1', username: 'admin', isAdmin: true, permissions: [],
    })
    mockLoadUsersPublicData.mockResolvedValue({ users: [{ id: 'user-2', username: 'bob', isAdmin: false, hasPassword: true }] })
    mockLoadSettings.mockResolvedValue({ ui: {}, system: { timezone: 'UTC' }, profile: {} })
    mockLoadHabitsData.mockResolvedValue({ habits: [{ id: 'habit-1', name: 'Read', description: '', frequency: 'daily', coinReward: 1, completions: [], userIds: ['user-1'] }] })

    const response = await POST(new Request('http://localhost:3000/api/v1/habits/habit-1/complete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'user-2' }) }), { params: Promise.resolve({ id: 'habit-1' }) })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ ok: false, error: { code: 'habit_not_found', message: 'Habit not found for the requested user.' } })
  })
})