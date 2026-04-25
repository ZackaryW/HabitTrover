import { loadCoinsData } from '@/app/actions/data'
import {
  filterCoinsByUserId,
  getListLimit,
  getRequestedUserId,
  limitItems,
  ok,
  resolveTargetUserId,
  withApiRoute,
} from '@/utils/api'

/**
 * Lists recent coin transactions for the authenticated caller or an admin-selected user.
 * Scope: API v1 coin transactions endpoint.
 */
export async function GET(request: Request) {
  return withApiRoute(request, async ({ user }) => {
    const limit = getListLimit(request)
    const targetUserId = await resolveTargetUserId(user, getRequestedUserId(request))
    const coinsData = filterCoinsByUserId(await loadCoinsData(), targetUserId)

    return ok({ transactions: limitItems(coinsData.transactions, limit), limit })
  })
}