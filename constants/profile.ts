export const AVATAR_IDS = [
  "bolt",
  "flame",
  "moon",
  "brain",
  "target",
  "rocket",
  "ghost",
  "cat",
  "bird",
  "crown",
  "star",
  "sparkles",
] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

export const AVATAR_LABELS: Record<AvatarId, string> = {
  bolt: "Bolt",
  flame: "Flame",
  moon: "Moon",
  brain: "Brain",
  target: "Bullseye",
  rocket: "Rocket",
  ghost: "Ghost",
  cat: "Cat",
  bird: "Bird",
  crown: "Crown",
  star: "Star",
  sparkles: "Sparkle",
};

export const AVATAR_COLORS = {
  violet: "#7c5cff",
  coral: "#ff6b57",
  mint: "#1fbf86",
  amber: "#f2a516",
  sky: "#3a9eff",
  rose: "#f0508a",
  lime: "#7cc22a",
  teal: "#12b3a5",
} as const;
export type AvatarColor = keyof typeof AVATAR_COLORS;
export const AVATAR_COLOR_IDS = Object.keys(AVATAR_COLORS) as AvatarColor[];

const ADJECTIVES = [
  "Swift", "Clever", "Sly", "Bold", "Lucky", "Witty", "Brave", "Cosmic",
  "Silent", "Fuzzy", "Quick", "Nimble", "Sunny", "Mighty", "Zesty", "Breezy",
];
const NOUNS = [
  "Otter", "Fox", "Panda", "Falcon", "Comet", "Tiger", "Koala", "Raven",
  "Lynx", "Gecko", "Bison", "Moose", "Heron", "Badger", "Wombat", "Orca",
];

export function randomGuestName(rand: () => number = Math.random): string {
  const a = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)]!;
  const n = NOUNS[Math.floor(rand() * NOUNS.length)]!;
  return `${a} ${n}`;
}
