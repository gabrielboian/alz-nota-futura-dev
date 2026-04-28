/**
 * Utility functions
 */

/**
 * Merge class names with proper precedence
 * Combines Tailwind classes without conflicts
 */
export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
