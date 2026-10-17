// Bundled artwork supplied for the planned draw. It is not an awarded prize
// and is displayed only when the server returns an actual draw ticket/period.
export function giftPrizeImage(
  prize: string | null | undefined
): number | undefined {
  return /iphone\s*18\b/i.test(prize || '')
    ? require('../../../assets/iphone-18-pro-01_5-1.webp')
    : undefined;
}
