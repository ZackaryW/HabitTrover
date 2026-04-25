import {
  loadCoinsData,
  loadHabitsData,
  loadSettings,
  loadUsersPublicData,
  loadWishlistData,
} from '@/app/actions/data'
import { getDefaultPublicUsersData } from '@/lib/types'
import { generateCryptoHash, prepareDataForHashing } from '@/lib/utils'
import {
  filterCoinsByUserId,
  filterHabitsByUserId,
  filterWishlistByUserId,
  ok,
  parseJsonBody,
  resolveTargetUserId,
  requireOptionalBoolean,
  requireString,
  withApiRoute,
  ApiError,
} from '@/utils/api'

type FreshnessCheckBody = {
  clientToken: unknown
  userId?: unknown
  includeUsers?: unknown
}

/**
 * Compares a caller-provided client freshness token with the current API-visible server state.
 * Scope: API v1 freshness endpoint.
 */
export async function POST(request: Request) {
  return withApiRoute(request, async ({ user }) => {
    const body = await parseJsonBody<FreshnessCheckBody>(request)
    const clientToken = requireString(body.clientToken, 'clientToken')
    const requestedUserId = typeof body.userId === 'string' ? body.userId : undefined
    const targetUserId = await resolveTargetUserId(user, requestedUserId)
    const includeUsers = requireOptionalBoolean(body.includeUsers, 'includeUsers') ?? false

    if (includeUsers && !user.isAdmin) {
      throw new ApiError(403, 'forbidden', 'Only administrators can include users in freshness checks.')
    }

    const settings = await loadSettings()
    const habits = filterHabitsByUserId(await loadHabitsData(), targetUserId)
    const coins = filterCoinsByUserId(await loadCoinsData(), targetUserId)
    const wishlist = filterWishlistByUserId(await loadWishlistData(), targetUserId)
    const users = includeUsers ? await loadUsersPublicData() : getDefaultPublicUsersData()
    const dataString = prepareDataForHashing(settings, habits, coins, wishlist, users)
    const serverToken = await generateCryptoHash(dataString)

    return ok({
      isFresh: clientToken === serverToken,
      serverToken,
    })
  })
}