import { Priority, Todo } from '../types';

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function sortByPriority(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
