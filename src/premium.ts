export const PREMIUM_PRODUCTS = [
  { id: 'com.pariah140.crateescape.welcomeaboard', name: 'Welcome Aboard', detail: 'Exclusive Harbour Festival paint and 30 Chart Tokens.', kind: 'bundle' },
  { id: 'com.pariah140.crateescape.paint.coral', name: 'Coral Sunset', detail: 'Coral hulls, cream sails, and a warm pennant for every boat.', kind: 'paint' },
  { id: 'com.pariah140.crateescape.paint.moon', name: 'Moonlit Tide', detail: 'Midnight blue hulls, pale sails, and a silver pennant.', kind: 'paint' },
  { id: 'com.pariah140.crateescape.yard.festival', name: 'Festival Dockyard', detail: 'Painted quay, colourful bunting, and a brighter workshop.', kind: 'yard' },
] as const;

export type PaintId = 'original' | 'festival' | 'coral' | 'moon';
export type YardThemeId = 'working' | 'festival';
export const PAINTS: Record<Exclude<PaintId, 'original'>, { color: string; sail: string; pennant: string; label: string }> = {
  festival: { color: '#e9a65f', sail: '#fff0bb', pennant: '#f47668', label: 'Harbour Festival' },
  coral: { color: '#f18477', sail: '#fff1cd', pennant: '#f7ce6b', label: 'Coral Sunset' },
  moon: { color: '#526baf', sail: '#e3edff', pennant: '#b9d6f8', label: 'Moonlit Tide' },
};

export function ownsPaint(paint: PaintId, entitlements: readonly string[]): boolean {
  if (paint === 'original') return true;
  if (paint === 'festival') return entitlements.includes(PREMIUM_PRODUCTS[0].id);
  return entitlements.includes(`com.pariah140.crateescape.paint.${paint}`);
}
export function ownsYardTheme(theme: YardThemeId, entitlements: readonly string[]): boolean {
  return theme === 'working' || entitlements.includes(PREMIUM_PRODUCTS[3].id);
}
export function boatChartCost(price: number): number { return Math.max(5, Math.ceil(price / 300)); }
export function chartedBoatPrice(price: number, discounted: boolean): number { return discounted ? Math.ceil(price / 2) : price; }
