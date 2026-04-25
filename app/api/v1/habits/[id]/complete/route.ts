import { loadHabitsData, loadSettings } from '@/app/actions/data'
import { completeHabitForApi } from '@/utils/api/domain'
import {
  ApiError,
  getRequestedUserId,
  ok,
  parseOptionalJsonBody,
  requirePermission,
  resolveTargetUserId,
  withApiRoute,
} from '@/utils/api'

type CompleteHabitBody = {
  userId?: unknown
}

/**
 * Completes a habit for the authenticated user or an admin-selected user target.
 * Scope: API v1 habit completion endpoint.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiRoute(request, async ({ user }) => {
    requirePermission(user, 'habit', 'interact')

    const { id } = await params
    const body = await parseOptionalJsonBody<CompleteHabitBody>(request)
    const requestedUserId = typeof body.userId === 'string' ? body.userId : getRequestedUserId(request)
    const targetUserId = await resolveTargetUserId(user, requestedUserId)
    const settings = await loadSettings()
    const habitsData = await loadHabitsData()
    const habit = habitsData.habits.find((candidateHabit) => candidateHabit.id === id)

    if (!habit) {
      throw new ApiError(404, 'habit_not_found', 'Habit not found.')
    }

    if (targetUserId && !habit.userIds?.includes(targetUserId)) {
      throw new ApiError(404, 'habit_not_found', 'Habit not found for the requested user.')
    }

    const result = await completeHabitForApi({
      habitsData,
      habitId: id,
      timezone: settings.system.timezone,
      coinUserId: targetUserId,
    })

    return ok({
      habit: result.habit,
      coins: result.coins,
      undoDepth: result.undoDepth,
    })
  })
}