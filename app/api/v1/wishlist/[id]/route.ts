import { loadWishlistData, saveWishlistItems } from '@/app/actions/data'
import { WishlistItemType } from '@/lib/types'
import {
  ApiError,
  normalizeOwnedUserIds,
  ok,
  parseJsonBody,
  requireNumber,
  requireOptionalBoolean,
  requirePermission,
  requireString,
  withApiRoute,
} from '@/utils/api'

type UpdateWishlistBody = {
  name?: unknown
  description?: unknown
  coinCost?: unknown
  archived?: unknown
  targetCompletions?: unknown
  link?: unknown
  drawing?: unknown
  userId?: unknown
  userIds?: unknown
}

/**
 * Updates an existing wishlist item that is visible to the authenticated caller.
 * Scope: API v1 wishlist item endpoint.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiRoute(request, async ({ user }) => {
    requirePermission(user, 'wishlist', 'write')

    const { id } = await params
    const body = await parseJsonBody<UpdateWishlistBody>(request)
    const wishlistData = await loadWishlistData()
    const item = wishlistData.items.find((candidateItem) => candidateItem.id === id)

    if (!item) {
      throw new ApiError(404, 'wishlist_item_not_found', 'Wishlist item not found.')
    }

    if (!user.isAdmin && !item.userIds?.includes(user.id)) {
      throw new ApiError(403, 'forbidden', 'You cannot update this wishlist item.')
    }

    const updatedItem: WishlistItemType = { ...item }
    if (typeof body.name !== 'undefined') updatedItem.name = requireString(body.name, 'name')
    if (typeof body.description !== 'undefined') updatedItem.description = typeof body.description === 'string' ? body.description : ''
    if (typeof body.coinCost !== 'undefined') updatedItem.coinCost = requireNumber(body.coinCost, 'coinCost')
    if (typeof body.archived !== 'undefined') updatedItem.archived = requireOptionalBoolean(body.archived, 'archived')
    if (typeof body.targetCompletions !== 'undefined') {
      if (body.targetCompletions !== null && typeof body.targetCompletions !== 'number') {
        throw new ApiError(400, 'invalid_request', 'targetCompletions must be a number or null.')
      }
      updatedItem.targetCompletions = typeof body.targetCompletions === 'number' ? body.targetCompletions : undefined
    }
    if (typeof body.link !== 'undefined') {
      if (body.link !== null && typeof body.link !== 'string') {
        throw new ApiError(400, 'invalid_request', 'link must be a string or null.')
      }
      updatedItem.link = typeof body.link === 'string' ? body.link : undefined
    }
    if (typeof body.drawing !== 'undefined') {
      if (body.drawing !== null && typeof body.drawing !== 'string') {
        throw new ApiError(400, 'invalid_request', 'drawing must be a string or null.')
      }
      updatedItem.drawing = typeof body.drawing === 'string' ? body.drawing : undefined
    }
    if (typeof body.userId !== 'undefined' || typeof body.userIds !== 'undefined') {
      updatedItem.userIds = await normalizeOwnedUserIds(
        user,
        typeof body.userId === 'string' ? body.userId : undefined,
        body.userIds
      )
    }

    await saveWishlistItems({
      items: wishlistData.items.map((candidateItem) =>
        candidateItem.id === id ? updatedItem : candidateItem
      ),
    })

    return ok({ item: updatedItem })
  })
}

/**
 * Deletes an existing wishlist item that is visible to the authenticated caller.
 * Scope: API v1 wishlist item endpoint.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiRoute(request, async ({ user }) => {
    requirePermission(user, 'wishlist', 'write')

    const { id } = await params
    const wishlistData = await loadWishlistData()
    const item = wishlistData.items.find((candidateItem) => candidateItem.id === id)

    if (!item) {
      throw new ApiError(404, 'wishlist_item_not_found', 'Wishlist item not found.')
    }

    if (!user.isAdmin && !item.userIds?.includes(user.id)) {
      throw new ApiError(403, 'forbidden', 'You cannot delete this wishlist item.')
    }

    await saveWishlistItems({
      items: wishlistData.items.filter((candidateItem) => candidateItem.id !== id),
    })

    return ok({ deleted: true })
  })
}