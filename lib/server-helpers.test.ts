import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'

const mockAuth = mock()
const mockHeaders = mock()
const mockReadFile = mock()

mock.module('@/auth', () => ({
  auth: mockAuth,
}))

mock.module('next/headers', () => ({
  headers: mockHeaders,
}))

mock.module('server-only', () => ({}))

mock.module('fs/promises', () => ({
  default: {
    readFile: mockReadFile,
  },
  readFile: mockReadFile,
}))

let getCurrentUser: typeof import('./server-helpers').getCurrentUser
let getCurrentUserId: typeof import('./server-helpers').getCurrentUserId

const originalApiAdminToken = process.env.API_ADMIN_TOKEN

beforeAll(async () => {
  ;({ getCurrentUser, getCurrentUserId } = await import('./server-helpers'))
})

afterEach(() => {
  mock.restore()

  if (originalApiAdminToken === undefined) {
    delete process.env.API_ADMIN_TOKEN
    return
  }

  process.env.API_ADMIN_TOKEN = originalApiAdminToken
})

describe('server API token helpers', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockHeaders.mockReset()
    mockReadFile.mockReset()
  })

  test('authenticates the first admin user from API_ADMIN_TOKEN', async () => {
    process.env.API_ADMIN_TOKEN = 'default-admin-token'
    mockHeaders.mockResolvedValue(new Headers({ authorization: 'Bearer default-admin-token' }))
    mockReadFile.mockResolvedValue(JSON.stringify({
      users: [
        { id: 'admin-1', username: 'admin', isAdmin: true },
        { id: 'user-1', username: 'alice', isAdmin: false },
      ],
    }))

    await expect(getCurrentUser()).resolves.toEqual({
      id: 'admin-1',
      username: 'admin',
      isAdmin: true,
    })
    await expect(getCurrentUserId()).resolves.toBe('admin-1')
    expect(mockAuth).not.toHaveBeenCalled()
  })

  test('ignores API_ADMIN_TOKEN when no admin user exists', async () => {
    process.env.API_ADMIN_TOKEN = 'default-admin-token'
    mockHeaders.mockResolvedValue(new Headers({ authorization: 'Bearer default-admin-token' }))
    mockReadFile.mockResolvedValue(JSON.stringify({
      users: [
        { id: 'user-1', username: 'alice', isAdmin: false },
      ],
    }))
    mockAuth.mockResolvedValue(null)

    await expect(getCurrentUser()).resolves.toBeUndefined()
    await expect(getCurrentUserId()).resolves.toBeUndefined()
  })
})