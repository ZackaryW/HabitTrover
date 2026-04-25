import { loadCoinsData } from '@/app/actions/data'
import { filterCoinsByUserId, getRequestedUserId, ok, resolveTargetUserId, withApiRoute } from '@/utils/api'

/**
 * Returns the current coin balance payload for the authenticated caller or an admin-selected user.
 * Scope: API v1 coins summary endpoint.
 */
export async function GET(request: Request) {
  return withApiRoute(request, async ({ user }) => {
    const targetUserId = await resolveTargetUserId(user, getRequestedUserId(request))
    const coinsData = filterCoinsByUserId(await loadCoinsData(), targetUserId)

    return ok({ coins: coinsData })
  })
}