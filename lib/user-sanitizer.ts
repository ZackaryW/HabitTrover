import { PublicUserData, UserData } from './types'

/**
 * Removes private user fields while keeping the public user payload shape stable.
 * Scope: user responses exposed to the client and API.
 */
export function sanitizeUserData(data: UserData): PublicUserData {
  return {
    users: data.users.map(({ password, language, ...user }) => ({
      ...user,
      hasPassword: !!password,
    })),
  }
}
