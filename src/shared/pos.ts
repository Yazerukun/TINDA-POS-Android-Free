/** Pure boundary used by the POS UI before replacing an existing cart. */
export function mayReplaceCart(currentItemCount: number, userConfirmed: boolean): boolean {
  return currentItemCount === 0 || userConfirmed
}
