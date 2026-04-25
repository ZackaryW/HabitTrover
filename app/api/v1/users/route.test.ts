import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'

const mockGetCurrentUser = mock()
const mockLoadUsersPublicData = mock()
const mockLoadHabitsData = mock()
const mockSaveHabitsData = mock()
const mockAddCoins = mock()

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

let GET: typeof import('./route').GET

beforeAll(async () => {
  ;({ GET } = await import('./route'))
})

afterEach(() => {
  mock.restore()
})

describe('GET /api/v1/users', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset()
    mockAddCoins.mockReset()
    mockLoadHabitsData.mockReset()
    mockLoadUsersPublicData.mockReset()
    mockSaveHabitsData.mockReset()
  })

  test('returns 401 when the request is unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(undefined)

    const response = await GET(new Request('http://localhost:3000/api/v1/users'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: 'unauthorized',
        message: 'A valid bearer token is required.',
      },
    })
  })

  test('returns 403 for non-admin users', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      username: 'alice',
      isAdmin: false,
      permissions: [],
    })

    const response = await GET(new Request('http://localhost:3000/api/v1/users'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: 'forbidden',
        message: 'Administrator access is required for this endpoint.',
      },
    })
    expect(mockLoadUsersPublicData).not.toHaveBeenCalled()
  })

  test('returns the requested limited admin user list', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      username: 'admin',
      isAdmin: true,
      permissions: [],
    })
    mockLoadUsersPublicData.mockResolvedValue({
      users: [
        { id: '1', username: 'alpha', isAdmin: false, hasPassword: true },
        { id: '2', username: 'beta', isAdmin: false, hasPassword: false },
      ],
    })

    const response = await GET(new Request('http://localhost:3000/api/v1/users?limit=1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        users: [
          { id: '1', username: 'alpha', isAdmin: false, hasPassword: true },
        ],
        limit: 1,
      },
    })
  })
})