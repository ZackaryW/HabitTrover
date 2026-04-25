import { saveWishlistItems, loadWishlistData } from '@/app/actions/data'
import { WishlistItemType } from '@/lib/types'
import { getNowInMilliseconds } from '@/lib/utils'
import {
  filterWishlistByUserId,
  getListLimit,
  getRequestedUserId,
  limitItems,
  normalizeOwnedUserIds,
  ok,
  parseJsonBody,
  requireNumber,
  requireOptionalBoolean,
  requirePermission,
  requireString,
  resolveTargetUserId,
  withApiRoute,
} from '@/utils/api'

type CreateWishlistBody = {
  name: unknown
  description?: unknown
  coinCost: unknown
  archived?: unknown
  targetCompletions?: unknown
  link?: unknown
  drawing?: unknown
  userId?: unknown
  userIds?: unknown
}

/**
 * Lists the visible wishlist items for the authenticated caller.
 * Scope: API v1 wishlist collection endpoint.
 */
export async function GET(request: Request) {
  return withApiRoute(request, async ({ user }) => {
    const limit = getListLimit(request)
    const targetUserId = await resolveTargetUserId(user, getRequestedUserId(request))
    const wishlistData = filterWishlistByUserId(await loadWishlistData(), targetUserId)

    return ok({ items: limitItems(wishlistData.items, limit), limit })
  })
}

/**
 * Creates a wishlist item for the authenticated caller or an admin-selected owner set.
 * Scope: API v1 wishlist collection endpoint.
 */
export async function POST(request: Request) {
  return withApiRoute(request, async ({ user }) => {
    requirePermission(user, 'wishlist', 'write')

    const body = await parseJsonBody<CreateWishlistBody>(request)
    const wishlistData = await loadWishlistData()
    const ownerUserIds = await normalizeOwnedUserIds(
      user,
      typeof body.userId === 'string' ? body.userId : undefined,
      body.userIds
    )
    const item: WishlistItemType = {
      id: getNowInMilliseconds().toString(),
      name: requireString(body.name, 'name'),
      description: typeof body.description === 'string' ? body.description : '',
      coinCost: requireNumber(body.coinCost, 'coinCost'),
      archived: requireOptionalBoolean(body.archived, 'archived'),
      targetCompletions: typeof body.targetCompletions === 'number' ? body.targetCompletions : undefined,
      link: typeof body.link === 'string' ? body.link : undefined,
      drawing: typeof body.drawing === 'string' ? body.drawing : undefined,
      userIds: ownerUserIds,
    }

    await saveWishlistItems({ items: [...wishlistData.items, item] })
    return ok({ item }, 201)
  })
}