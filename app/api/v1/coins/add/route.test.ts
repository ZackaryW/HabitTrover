import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'

const mockGetCurrentUser = mock()
const mockAddCoins = mock()
const mockLoadHabitsData = mock()
const mockSaveHabitsData = mock()
const mockLoadUsersPublicData = mock()

mock.module('@/lib/server-helpers', () => ({
  getCurrentUser: mockGetCurrentUser,
}))

mock.module('@/app/actions/data', () => ({
  addCoins: mockAddCoins,
  getUser: mock(),
  loadCoinsData: mock(),
  loadHabitsData: mockLoadHabitsData,
  loadSettings: mock(),
  loadUsersPublicData: mockLoadUsersPublicData,
  saveHabitsData: mockSaveHabitsData,
  loadWishlistData: mock(),
  removeCoins: mock(),
  saveCoinsData: mock(),
  saveSettings: mock(),
  saveWishlistItems: mock(),
}))

let POST: typeof import('./route').POST

beforeAll(async () => {
  ;({ POST } = await import('./route'))
})

afterEach(() => {
  mock.restore()
})

describe('POST /api/v1/coins/add', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset()
    mockAddCoins.mockReset()
    mockLoadHabitsData.mockReset()
    mockLoadUsersPublicData.mockReset()
    mockSaveHabitsData.mockReset()
  })

  test('returns 403 when the user lacks coin write permission', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      isAdmin: false,
      permissions: [
        {
          habit: { write: false, interact: false },
          wishlist: { write: false, interact: false },
          coins: { write: false, interact: false },
        },
      ],
    })

    const response = await POST(new Request('http://localhost:3000/api/v1/coins/add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 5, description: 'Bonus' }),
    }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: 'forbidden',
        message: 'You do not have permission to access this resource.',
      },
    })
  })

  test('allows an admin to add coins for another user', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      username: 'admin',
      isAdmin: true,
      permissions: [],
    })
    mockLoadUsersPublicData.mockResolvedValue({
      users: [
        { id: 'user-1', username: 'alice', isAdmin: false, hasPassword: true },
      ],
    })
    mockAddCoins.mockResolvedValue({
      balance: 12,
      transactions: [
        { id: 'txn-1', amount: 12, description: 'Bonus', timestamp: '2026-04-24T00:00:00.000Z', type: 'MANUAL_ADJUSTMENT', userId: 'user-1' },
      ],
    })

    const response = await POST(new Request('http://localhost:3000/api/v1/coins/add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 12, description: 'Bonus', userId: 'user-1' }),
    }))

    expect(response.status).toBe(200)
    expect(mockAddCoins).toHaveBeenCalledWith({
      amount: 12,
      description: 'Bonus',
      note: undefined,
      type: 'MANUAL_ADJUSTMENT',
      userId: 'user-1',
    })
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        coins: {
          balance: 12,
          transactions: [
            { id: 'txn-1', amount: 12, description: 'Bonus', timestamp: '2026-04-24T00:00:00.000Z', type: 'MANUAL_ADJUSTMENT', userId: 'user-1' },
          ],
        },
      },
    })
  })
})