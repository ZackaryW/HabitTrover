import { loadWishlistData, saveWishlistItems } from '@/app/actions/data'
import { ApiError, ok, requirePermission, withApiRoute } from '@/utils/api'

/**
 * Unarchives a visible wishlist item.
 * Scope: API v1 wishlist unarchive endpoint.
 */
export async function POST(
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
      throw new ApiError(403, 'forbidden', 'You cannot unarchive this wishlist item.')
    }

    const updatedItem = { ...item, archived: false }
    await saveWishlistItems({
      items: wishlistData.items.map((candidateItem) =>
        candidateItem.id === id ? updatedItem : candidateItem
      ),
    })

    return ok({ item: updatedItem })
  })
}