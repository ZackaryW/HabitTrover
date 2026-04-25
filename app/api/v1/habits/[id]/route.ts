import { loadHabitsData, saveHabitsData } from '@/app/actions/data'
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

type UpdateHabitBody = {
  name?: unknown
  description?: unknown
  frequency?: unknown
  coinReward?: unknown
  targetCompletions?: unknown
  isTask?: unknown
  archived?: unknown
  pinned?: unknown
  drawing?: unknown
  userId?: unknown
  userIds?: unknown
}

/**
 * Updates an existing habit that is visible to the authenticated caller.
 * Scope: API v1 habit resource endpoint.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiRoute(request, async ({ user }) => {
    requirePermission(user, 'habit', 'write')

    const { id } = await params
    const body = await parseJsonBody<UpdateHabitBody>(request)
    const habitsData = await loadHabitsData()
    const habit = habitsData.habits.find((candidateHabit) => candidateHabit.id === id)

    if (!habit) {
      throw new ApiError(404, 'habit_not_found', 'Habit not found.')
    }

    if (!user.isAdmin && !habit.userIds?.includes(user.id)) {
      throw new ApiError(403, 'forbidden', 'You cannot update this habit.')
    }

    const updatedHabit = { ...habit }
    if (typeof body.name !== 'undefined') updatedHabit.name = requireString(body.name, 'name')
    if (typeof body.description !== 'undefined') updatedHabit.description = typeof body.description === 'string' ? body.description : ''
    if (typeof body.frequency !== 'undefined') updatedHabit.frequency = requireString(body.frequency, 'frequency')
    if (typeof body.coinReward !== 'undefined') updatedHabit.coinReward = requireNumber(body.coinReward, 'coinReward')
    if (typeof body.targetCompletions !== 'undefined') {
      if (body.targetCompletions !== null && typeof body.targetCompletions !== 'number') {
        throw new ApiError(400, 'invalid_request', 'targetCompletions must be a number or null.')
      }
      updatedHabit.targetCompletions = typeof body.targetCompletions === 'number' ? body.targetCompletions : undefined
    }
    if (typeof body.isTask !== 'undefined') updatedHabit.isTask = requireOptionalBoolean(body.isTask, 'isTask')
    if (typeof body.archived !== 'undefined') updatedHabit.archived = requireOptionalBoolean(body.archived, 'archived')
    if (typeof body.pinned !== 'undefined') updatedHabit.pinned = requireOptionalBoolean(body.pinned, 'pinned')
    if (typeof body.drawing !== 'undefined') {
      if (body.drawing !== null && typeof body.drawing !== 'string') {
        throw new ApiError(400, 'invalid_request', 'drawing must be a string or null.')
      }
      updatedHabit.drawing = typeof body.drawing === 'string' ? body.drawing : undefined
    }
    if (typeof body.userId !== 'undefined' || typeof body.userIds !== 'undefined') {
      updatedHabit.userIds = await normalizeOwnedUserIds(
        user,
        typeof body.userId === 'string' ? body.userId : undefined,
        body.userIds
      )
    }

    await saveHabitsData({
      habits: habitsData.habits.map((candidateHabit) =>
        candidateHabit.id === id ? updatedHabit : candidateHabit
      ),
    })

    return ok({ habit: updatedHabit })
  })
}

/**
 * Deletes an existing habit that is visible to the authenticated caller.
 * Scope: API v1 habit resource endpoint.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiRoute(request, async ({ user }) => {
    requirePermission(user, 'habit', 'write')

    const { id } = await params
    const habitsData = await loadHabitsData()
    const habit = habitsData.habits.find((candidateHabit) => candidateHabit.id === id)

    if (!habit) {
      throw new ApiError(404, 'habit_not_found', 'Habit not found.')
    }

    if (!user.isAdmin && !habit.userIds?.includes(user.id)) {
      throw new ApiError(403, 'forbidden', 'You cannot delete this habit.')
    }

    await saveHabitsData({
      habits: habitsData.habits.filter((candidateHabit) => candidateHabit.id !== id),
    })

    return ok({ deleted: true })
  })
}