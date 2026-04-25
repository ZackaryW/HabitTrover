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
  saveHabitsData: mockSaveHabitsData,
  loadUsersPublicData: mockLoadUsersPublicData,
  loadWishlistData: mock(),
  removeCoins: mock(),
  saveCoinsData: mock(),
  saveSettings: mock(),
  saveWishlistItems: mock(),
}))

let GET: typeof import('./route').GET
let POST: typeof import('./route').POST

beforeAll(async () => {
  ;({ GET, POST } = await import('./route'))
})

afterEach(() => {
  mock.restore()
})

describe('API v1 habits collection', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset()
    mockAddCoins.mockReset()
    mockLoadHabitsData.mockReset()
    mockSaveHabitsData.mockReset()
    mockLoadUsersPublicData.mockReset()
  })

  test('lists habits using the requested limit', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      isAdmin: false,
      permissions: [],
    })
    mockLoadHabitsData.mockResolvedValue({
      habits: [
        { id: '1', name: 'Read', description: '', frequency: 'daily', coinReward: 1, completions: [], userIds: ['user-1'] },
        { id: '2', name: 'Stretch', description: '', frequency: 'daily', coinReward: 1, completions: [], userIds: ['user-1'] },
      ],
    })

    const response = await GET(new Request('http://localhost:3000/api/v1/habits?limit=1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        habits: [
          { id: '1', name: 'Read', description: '', frequency: 'daily', coinReward: 1, completions: [], userIds: ['user-1'] },
        ],
        limit: 1,
      },
    })
  })

  test('creates a habit for a permitted non-admin user', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      isAdmin: false,
      permissions: [
        {
          habit: { write: true, interact: true },
          wishlist: { write: false, interact: false },
          coins: { write: false, interact: false },
        },
      ],
    })
    mockLoadHabitsData.mockResolvedValue({ habits: [] })
    mockSaveHabitsData.mockResolvedValue(undefined)

    const response = await POST(new Request('http://localhost:3000/api/v1/habits', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Meditate',
        frequency: 'daily',
        coinReward: 5,
      }),
    }))

    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.habit).toMatchObject({
      name: 'Meditate',
      description: '',
      frequency: 'daily',
      coinReward: 5,
      completions: [],
      userIds: ['user-1'],
    })
    expect(mockSaveHabitsData).toHaveBeenCalledWith({
      habits: [
        expect.objectContaining({
          name: 'Meditate',
          frequency: 'daily',
          coinReward: 5,
          userIds: ['user-1'],
        }),
      ],
    })
  })
})