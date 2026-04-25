import {
  addCoins,
  loadCoinsData,
  removeCoins,
  saveHabitsData,
  saveWishlistItems,
} from '@/app/actions/data'
import { CoinsData, Habit, HabitsData, WishlistData, WishlistItemType } from '@/lib/types'
import { d2t, getCompletionsForDate, getNow, t2d } from '@/lib/utils'
import { ApiError } from '@/utils/api'

export type HabitActionResult = {
  habit: Habit
  habits: HabitsData
  coins?: CoinsData
  undoDepth: number
}

export type WishlistRedeemResult = {
  item: WishlistItemType
  wishlist: WishlistData
  coins: CoinsData
}

/**
 * Completes a habit once and awards coins when the target threshold is reached.
 * Scope: API v1 habit completion endpoint.
 */
export async function completeHabitForApi(args: {
  habitsData: HabitsData
  habitId: string
  timezone: string
  coinUserId?: string
}): Promise<HabitActionResult> {
  const { habitsData, habitId, timezone, coinUserId } = args
  const habit = habitsData.habits.find((candidateHabit) => candidateHabit.id === habitId)

  if (!habit) {
    throw new ApiError(404, 'habit_not_found', 'Habit not found.')
  }

  const completionsToday = getCompletionsForDate({
    habit,
    date: t2d({ timestamp: d2t({ dateTime: getNow({ timezone }) }), timezone }),
    timezone,
  })
  const target = habit.targetCompletions || 1

  if (completionsToday >= target) {
    throw new ApiError(409, 'already_completed', 'Habit is already complete for the current period.')
  }

  const updatedHabit: Habit = {
    ...habit,
    completions: [...habit.completions, d2t({ dateTime: getNow({ timezone }) })],
    archived: habit.isTask && completionsToday + 1 === target ? true : habit.archived,
  }
  const updatedHabits: HabitsData = {
    habits: habitsData.habits.map((candidateHabit) =>
      candidateHabit.id === habit.id ? updatedHabit : candidateHabit
    ),
  }

  await saveHabitsData(updatedHabits)

  let updatedCoins: CoinsData | undefined
  if (completionsToday + 1 === target) {
    updatedCoins = await addCoins({
      amount: habit.coinReward,
      description: `Completed: ${habit.name}`,
      type: habit.isTask ? 'TASK_COMPLETION' : 'HABIT_COMPLETION',
      relatedItemId: habit.id,
      userId: coinUserId,
    })
  }

  return {
    habit: updatedHabit,
    habits: updatedHabits,
    coins: updatedCoins,
    undoDepth: Math.min(updatedHabit.completions.length, 10),
  }
}

/**
 * Undoes the latest habit completion when a recent completion exists.
 * Scope: API v1 habit undo endpoint.
 */
export async function undoLatestHabitCompletionForApi(args: {
  habitsData: HabitsData
  habitId: string
  timezone: string
  coinUserId?: string
}): Promise<HabitActionResult> {
  const { habitsData, habitId, timezone, coinUserId } = args
  const habit = habitsData.habits.find((candidateHabit) => candidateHabit.id === habitId)

  if (!habit) {
    throw new ApiError(404, 'habit_not_found', 'Habit not found.')
  }

  if (habit.completions.length === 0) {
    throw new ApiError(409, 'no_completion_to_undo', 'There are no habit completions to undo.')
  }

  const undoableCompletions = habit.completions.slice(-10)
  if (undoableCompletions.length === 0) {
    throw new ApiError(409, 'no_completion_to_undo', 'There are no recent habit completions to undo.')
  }

  const removedCompletionTimestamp = undoableCompletions[undoableCompletions.length - 1]
  const removedCompletionDate = t2d({ timestamp: removedCompletionTimestamp, timezone })
  const completionsOnRemovedDate = getCompletionsForDate({
    habit,
    date: removedCompletionDate,
    timezone,
  })
  const target = habit.targetCompletions || 1
  const updatedHabit: Habit = {
    ...habit,
    completions: habit.completions.slice(0, -1),
    archived: habit.isTask ? false : habit.archived,
  }
  const updatedHabits: HabitsData = {
    habits: habitsData.habits.map((candidateHabit) =>
      candidateHabit.id === habit.id ? updatedHabit : candidateHabit
    ),
  }

  await saveHabitsData(updatedHabits)

  let updatedCoins: CoinsData | undefined
  if (completionsOnRemovedDate === target) {
    updatedCoins = await removeCoins({
      amount: habit.coinReward,
      description: `Undid completion: ${habit.name}`,
      type: habit.isTask ? 'TASK_UNDO' : 'HABIT_UNDO',
      relatedItemId: habit.id,
      userId: coinUserId,
    })
  } else {
    updatedCoins = await loadCoinsData()
  }

  return {
    habit: updatedHabit,
    habits: updatedHabits,
    coins: updatedCoins,
    undoDepth: Math.min(updatedHabit.completions.length, 10),
  }
}

/**
 * Redeems a wishlist item and decrements its completion budget when configured.
 * Scope: API v1 wishlist redeem endpoint.
 */
export async function redeemWishlistItemForApi(args: {
  wishlistData: WishlistData
  itemId: string
  availableBalance: number
  coinUserId?: string
}): Promise<WishlistRedeemResult> {
  const { wishlistData, itemId, availableBalance, coinUserId } = args
  const item = wishlistData.items.find((candidateItem) => candidateItem.id === itemId)

  if (!item) {
    throw new ApiError(404, 'wishlist_item_not_found', 'Wishlist item not found.')
  }

  if (availableBalance < item.coinCost) {
    throw new ApiError(409, 'insufficient_balance', 'Not enough coins are available to redeem this item.')
  }

  if (item.targetCompletions !== undefined && item.targetCompletions <= 0) {
    throw new ApiError(409, 'redemption_limit_reached', 'This wishlist item has reached its redemption limit.')
  }

  const updatedCoins = await removeCoins({
    amount: item.coinCost,
    description: `Redeemed reward: ${item.name}`,
    type: 'WISH_REDEMPTION',
    relatedItemId: item.id,
    userId: coinUserId,
  })

  let updatedItem = item
  let updatedWishlist = wishlistData

  if (item.targetCompletions !== undefined) {
    const nextTarget = item.targetCompletions - 1
    updatedItem = {
      ...item,
      targetCompletions: nextTarget > 0 ? nextTarget : undefined,
      archived: nextTarget <= 0 ? true : item.archived,
    }
    updatedWishlist = {
      items: wishlistData.items.map((candidateItem) =>
        candidateItem.id === item.id ? updatedItem : candidateItem
      ),
    }
    await saveWishlistItems(updatedWishlist)
  }

  return {
    item: updatedItem,
    wishlist: updatedWishlist,
    coins: updatedCoins,
  }
}