import { loadUsersPublicData } from '@/app/actions/data'
import { getListLimit, limitItems, ok, requireAdmin, withApiRoute } from '@/utils/api'

/**
 * Lists sanitized users for admin API clients.
 * Scope: API v1 users endpoint.
 */
export async function GET(request: Request) {
  return withApiRoute(request, async ({ user }) => {
    requireAdmin(user)

    const limit = getListLimit(request)
    const usersData = await loadUsersPublicData()

    return ok({ users: limitItems(usersData.users, limit), limit })
  })
}