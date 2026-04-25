import { loadCoinsData, saveCoinsData } from '@/app/actions/data'
import { ApiError, ok, parseJsonBody, requirePermission, withApiRoute } from '@/utils/api'

type UpdateTransactionBody = {
  note?: unknown
}

/**
 * Updates the note attached to a visible coin transaction.
 * Scope: API v1 coin transaction endpoint.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiRoute(request, async ({ user }) => {
    requirePermission(user, 'coins', 'write')

    const { id } = await params
    const body = await parseJsonBody<UpdateTransactionBody>(request)
    const coinsData = await loadCoinsData()
    const transaction = coinsData.transactions.find((candidateTransaction) => candidateTransaction.id === id)

    if (!transaction) {
      throw new ApiError(404, 'transaction_not_found', 'Transaction not found.')
    }

    if (!user.isAdmin && transaction.userId !== user.id) {
      throw new ApiError(403, 'forbidden', 'You cannot update this transaction.')
    }

    if (body.note !== null && typeof body.note !== 'undefined' && typeof body.note !== 'string') {
      throw new ApiError(400, 'invalid_request', 'note must be a string or null.')
    }

    const updatedTransaction = {
      ...transaction,
      note: typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : undefined,
    }

    await saveCoinsData({
      ...coinsData,
      transactions: coinsData.transactions.map((candidateTransaction) =>
        candidateTransaction.id === id ? updatedTransaction : candidateTransaction
      ),
    })

    return ok({ transaction: updatedTransaction })
  })
}