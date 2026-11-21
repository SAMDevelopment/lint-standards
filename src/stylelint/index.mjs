const SPACING_PROPERTIES = "/^(padding|gap|row-gap|column-gap|grid-gap|grid-row-gap|grid-column-gap)(-|$)/";

const MARGIN_PROPERTIES = "/^margin(-|$)/";

const FONT_PROPERTIES = "/^font(?!-style$)(-|$)/";
const FONT_STYLE_PROPERTY = "font-style";
const FONT_STYLE_KEYWORDS = ["normal", "italic", "oblique"];

const COLOR_PROPERTIES = "/(^|-)color$/";

const COLOR_FUNCTIONS = ["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color", "color-mix"];

const DEFAULT_ALLOWED_FONT_VALUES = ["inherit", "initial", "unset", "revert"];

const DEFAULT_ALLOWED_COLOR_VALUES = ["inherit", "initial", "unset", "revert", "transparent", "currentColor"];

export default createStylelintConfig();

function createStylelintConfig(options = {}) {
  const {
    allowedFontValues = DEFAULT_ALLOWED_FONT_VALUES,
    allowedColorValues = DEFAULT_ALLOWED_COLOR_VALUES,
    tokenFunctions = ["var"],
  } = options;

  return {
    rules: {
      "declaration-property-value-allowed-list": {
        [MARGIN_PROPERTIES]: ["/^(auto|0)( (auto|0)){0,3}$/"],
        [FONT_PROPERTIES]: allowList(allowedFontValues, tokenFunctions),
        [FONT_STYLE_PROPERTY]: allowList([...allowedFontValues, ...FONT_STYLE_KEYWORDS], tokenFunctions, true),
        [COLOR_PROPERTIES]: allowList(allowedColorValues, tokenFunctions),
      },
      "declaration-property-value-disallowed-list": {
        [SPACING_PROPERTIES]: ["/(^|[^\\w-])-?\\d*\\.?\\d+px\\b/i"],
      },
      "color-no-hex": true,
      "color-named": "never",
      "function-disallowed-list": COLOR_FUNCTIONS,
    },
  };
}

function allowList(values, tokenFunctions, allowArguments = false) {
  const tokens = tokenFunctions.map((name) => `${escapePattern(name)}\\(`).join("|");
  const keywords = values.map(escapePattern).join("|");
  const tail = allowArguments ? "( .+)?" : "";
  return [`/^(${keywords})${tail}$/`, `/^(${tokens})/`];
}

function escapePattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { createStylelintConfig };
