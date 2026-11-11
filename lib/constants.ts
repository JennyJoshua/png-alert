export const PROVINCES = [
  "Bougainville", "Central", "Chimbu", "East New Britain", "East Sepik", "Eastern Highlands", "Enga", "Gulf", "Hela", "Jiwaka",
  "Madang", "Manus", "Milne Bay", "Morobe", "National Capital District", "New Ireland", "Oro", "Southern Highlands",
  "West New Britain", "West Sepik", "Western", "Western Highlands",
] as const;

export const CATEGORIES = {
  roads_transport: "Roads & transport",
  utilities: "Utilities",
  public_services: "Public services",
  official_notices: "Official & community notices",
  news_information: "News & information",
} as const;
export type CategoryKey = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as [CategoryKey, ...CategoryKey[]];

export const PLATFORMS = {
  facebook: "Facebook post or Page",
  other_social: "Other social media",
  news: "News article",
  official_notice: "Official notice",
} as const;
export type PlatformKey = keyof typeof PLATFORMS;
export const PLATFORM_KEYS = Object.keys(PLATFORMS) as [PlatformKey, ...PlatformKey[]];

export const PNG_TIME_ZONE = "Pacific/Port_Moresby"; // UTC+10, no daylight saving
export const PAGE_SIZE = 20;
