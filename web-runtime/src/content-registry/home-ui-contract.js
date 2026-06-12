export const HOME_TAB_KEYS = [
  "home",
  "more",
  "chapters",
  "start",
  "journey",
  "materials",
  "quests",
  "bestiary",
  "talents",
  "artifacts",
  "cultivation",
  "facilities",
];

export const MOBILE_NAV_KEYS = [
  "home",
  "build",
  "quests",
  "chapters",
  "more",
];

export const UI_BUTTON_STATES = ["idle", "active", "emphasis"];
export const UI_NAV_STATES = ["idle", "active"];

export const HOME_PANEL_ROLES_BY_TAB = {
  home: ["dailyDecree", "continueRun", "currentBuild", "claimableRewards", "chapterRecommendation"],
  more: ["header", "journey", "materials", "quests", "bestiary", "talents", "artifacts", "cultivation", "facilities"],
  chapters: ["overview", "chapterCard", "drops", "encounter", "boss"],
  start: ["overview"],
  journey: ["hero"],
  materials: ["overview"],
  quests: ["overview"],
  bestiary: ["hero"],
  talents: ["overview"],
  artifacts: ["overview"],
  cultivation: ["overview"],
  facilities: ["overview"],
};

export const HOME_BUTTON_ACTIONS_BY_TAB = {
  home: ["openMore", "startRun", "openChapters", "openBuild", "openQuests", "applyRecommendation"],
  more: ["backHome", "enterDetail"],
  chapters: ["openChapters", "applyRecommendation", "startRun"],
  start: ["startRun", "applyRecommendation"],
  journey: ["openChapters", "openQuests"],
  materials: ["openChapters"],
  quests: ["openQuests"],
  bestiary: ["startRun", "openChapters", "openBuild"],
  talents: ["applyRecommendation"],
  artifacts: ["applyRecommendation"],
  cultivation: ["applyRecommendation"],
  facilities: ["applyRecommendation"],
};

export const UI_BUTTON_KEYS = [
  "startRun",
  "openMore",
  "backHome",
  "openChapters",
  "openBuild",
  "openQuests",
  "applyRecommendation",
  "enterDetail",
  "returnBattle",
  "saveTools",
];

export const MOBILE_NAV_PRELOAD_KEYS = ["home", "build", "quests", "more"];
