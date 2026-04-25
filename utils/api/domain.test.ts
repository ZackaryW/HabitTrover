import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { getTodayInTimezone } from '@/lib/utils'

const mockAddCoins = mock()
const mockAuth = mock()
const mockGetCurrentUser = mock()
const mockGetUser = mock()
const mockLoadCoinsData = mock()
const mockLoadUsersPublicData = mock()
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

let completeHabitForApi: typeof import('./domain').completeHabitForApi
let redeemWishlistItemForApi: typeof import('./domain').redeemWishlistItemForApi
let undoLatestHabitCompletionForApi: typeof import('./domain').undoLatestHabitCompletionForApi

beforeAll(async () => {
  ({ completeHabitForApi, redeemWishlistItemForApi, undoLatestHabitCompletionForApi } = await import('./domain'))
})

afterEach(() => { mock.restore() })

describe('utils/api/domain', () => {
  beforeEach(() => {
    mockAddCoins.mockReset()
    mockAuth.mockReset()
    mockGetCurrentUser.mockReset()
    mockGetUser.mockReset()
    mockLoadCoinsData.mockReset()
    mockLoadUsersPublicData.mockReset()
    mockRemoveCoins.mockReset()
    mockSaveHabitsData.mockReset()
    mockSaveWishlistItems.mockReset()
  })

  test('completes a habit and awards coins at the target threshold', async () => {
    mockSaveHabitsData.mockResolvedValue(undefined)
    mockAddCoins.mockResolvedValue({ balance: 5, transactions: [] })

    const result = await completeHabitForApi({
      habitsData: { habits: [{ id: 'h1', name: 'Read', description: '', frequency: 'daily', coinReward: 5, targetCompletions: 1, completions: [], userIds: ['u1'] }] },
      habitId: 'h1',
      timezone: 'UTC',
      coinUserId: 'u1',
    })

    expect(result.habit.completions).toHaveLength(1)
    expect(mockAddCoins).toHaveBeenCalled()
  })

  test('rejects duplicate completions and missing undos', async () => {
    const completionToday = `${getTodayInTimezone('UTC')}T00:00:00.000Z`
    await expect(completeHabitForApi({ habitsData: { habits: [{ id: 'h1', name: 'Read', description: '', frequency: 'daily', coinReward: 5, targetCompletions: 1, completions: [completionToday], userIds: ['u1'] }] }, habitId: 'h1', timezone: 'UTC' })).rejects.toMatchObject({ code: 'already_completed' })
    await expect(undoLatestHabitCompletionForApi({ habitsData: { habits: [{ id: 'h1', name: 'Read', description: '', frequency: 'daily', coinReward: 5, completions: [], userIds: ['u1'] }] }, habitId: 'h1', timezone: 'UTC' })).rejects.toMatchObject({ code: 'no_completion_to_undo' })
  })

  test('undoes a completion and removes coins when the target was met', async () => {
    mockSaveHabitsData.mockResolvedValue(undefined)
    mockRemoveCoins.mockResolvedValue({ balance: 0, transactions: [] })

    const timestamp = new Date().toISOString()
    const result = await undoLatestHabitCompletionForApi({
      habitsData: { habits: [{ id: 'h1', name: 'Read', description: '', frequency: 'daily', coinReward: 5, targetCompletions: 1, completions: [timestamp], userIds: ['u1'] }] },
      habitId: 'h1', timezone: 'UTC', coinUserId: 'u1',
    })

    expect(result.habit.completions).toEqual([])
    expect(mockRemoveCoins).toHaveBeenCalled()
  })

  test('redeems wishlist items and enforces balance rules', async () => {
    mockRemoveCoins.mockResolvedValue({ balance: 0, transactions: [] })
    mockSaveWishlistItems.mockResolvedValue(undefined)

    await expect(redeemWishlistItemForApi({ wishlistData: { items: [{ id: 'w1', name: 'Movie', description: '', coinCost: 10, userIds: ['u1'] }] }, itemId: 'w1', availableBalance: 0 })).rejects.toMatchObject({ code: 'insufficient_balance' })

    const result = await redeemWishlistItemForApi({ wishlistData: { items: [{ id: 'w1', name: 'Movie', description: '', coinCost: 10, targetCompletions: 1, userIds: ['u1'] }] }, itemId: 'w1', availableBalance: 10, coinUserId: 'u1' })
    expect(result.item.archived).toBe(true)
    expect(mockSaveWishlistItems).toHaveBeenCalled()
  })
})