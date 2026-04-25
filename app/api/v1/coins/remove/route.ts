import { removeCoins } from '@/app/actions/data'
import { filterCoinsByUserId, ok, parseJsonBody, requireNumber, requirePermission, requireString, resolveTargetUserId, withApiRoute, ApiError } from '@/utils/api'

type RemoveCoinsBody = {
  amount: unknown
  description: unknown
  note?: unknown
  userId?: unknown
}

/**
 * Removes coins for the authenticated caller or an admin-selected user.
 * Scope: API v1 remove coins action endpoint.
 */
export async function POST(request: Request) {
  return withApiRoute(request, async ({ user }) => {
    requirePermission(user, 'coins', 'write')

    const body = await parseJsonBody<RemoveCoinsBody>(request)
    const amount = requireNumber(body.amount, 'amount')
    const description = requireString(body.description, 'description')
    const targetUserId = await resolveTargetUserId(user, typeof body.userId === 'string' ? body.userId : undefined)

    if (amount <= 0) {
      throw new ApiError(400, 'invalid_request', 'amount must be greater than zero.')
    }

    const coinsData = await removeCoins({
      amount,
      description,
      note: typeof body.note === 'string' ? body.note : undefined,
      type: 'MANUAL_ADJUSTMENT',
      userId: targetUserId,
    })

    return ok({ coins: filterCoinsByUserId(coinsData, targetUserId) })
  })
}