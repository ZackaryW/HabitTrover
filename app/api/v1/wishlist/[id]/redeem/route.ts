import { loadCoinsData, loadWishlistData } from '@/app/actions/data'
import { redeemWishlistItemForApi } from '@/utils/api/domain'
import {
  ApiError,
  filterCoinsByUserId,
  ok,
  parseOptionalJsonBody,
  requirePermission,
  resolveTargetUserId,
  withApiRoute,
} from '@/utils/api'

type RedeemWishlistBody = {
  userId?: unknown
}

/**
 * Redeems a wishlist item for the authenticated caller or an admin-selected user.
 * Scope: API v1 wishlist redeem endpoint.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiRoute(request, async ({ user }) => {
    requirePermission(user, 'wishlist', 'interact')

    const { id } = await params
    const body = await parseOptionalJsonBody<RedeemWishlistBody>(request)
    const targetUserId = await resolveTargetUserId(user, typeof body.userId === 'string' ? body.userId : undefined)
    const wishlistData = await loadWishlistData()
    const item = wishlistData.items.find((candidateItem) => candidateItem.id === id)

    if (!item) {
      throw new ApiError(404, 'wishlist_item_not_found', 'Wishlist item not found.')
    }

    if (targetUserId && !item.userIds?.includes(targetUserId)) {
      throw new ApiError(404, 'wishlist_item_not_found', 'Wishlist item not found for the requested user.')
    }

    const visibleCoins = filterCoinsByUserId(await loadCoinsData(), targetUserId)
    const result = await redeemWishlistItemForApi({
      wishlistData,
      itemId: id,
      availableBalance: visibleCoins.balance,
      coinUserId: targetUserId,
    })

    return ok({
      item: result.item,
      coins: filterCoinsByUserId(result.coins, targetUserId),
    })
  })
}