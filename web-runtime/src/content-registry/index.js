import { catTheme, officeTheme, themes, xianxiaTheme } from "./themes.js";

/**
 * 创建主题目录。
 * 入参：主题字典，key 为主题 id，value 为主题配置。
 * 出参：包含主题查询和主题内容 adapter 的目录对象。
 * 作用：把运行时选择主题和按领域读取主题内容集中到单一 seam。
 */
export function createThemeRegistry(themeCatalog = themes) {
  return {
    catalog: themeCatalog,
    getTheme(themeId = "xianxia") {
      return themeCatalog[themeId] || themeCatalog.xianxia;
    },
    createContent(theme) {
      return createThemeContentRegistry(theme);
    },
  };
}

/**
 * 创建主题内容 registry。
 * 入参：单个主题配置。
 * 出参：战斗、元进度、洞府视觉、调试元信息四组 adapter。
 * 作用：降低调用方对原始 theme 大对象的直接依赖。
 */
export function createThemeContentRegistry(theme) {
  const meta = theme?.meta || {};
  return {
    battle: {
      assetBase: theme?.assetBase || "",
      background: theme?.background || {},
      copy: theme?.copy || {},
      enemies: theme?.enemies || {},
      equipmentSlots: theme?.equipmentSlots || {},
      heroRealms: theme?.heroRealms || [],
      hudIcons: theme?.hudIcons || {},
      pickups: theme?.pickups || {},
      player: theme?.player || {},
      realms: theme?.realms || [],
      upgrades: theme?.upgrades || [],
      waves: theme?.waves || [],
      weapons: theme?.weapons || {},
    },
    metaProgression: meta,
    homeVisuals: {
      homeAssets: meta.homeAssets || {},
      uiAssets: meta.uiAssets || {},
      panelFallbacks: meta.uiAssets?.panelFallbacks || {},
      buttonFallbacks: meta.uiAssets?.buttonFallbacks || {},
    },
    debug: {
      name: theme?.name || "",
      rawTheme: theme,
    },
  };
}

export const themeRegistry = createThemeRegistry(themes);
export const xianxiaContent = createThemeContentRegistry(xianxiaTheme);

export {
  catTheme,
  officeTheme,
  themes,
  xianxiaTheme,
};
