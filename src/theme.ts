import { theme as antTheme, type ThemeConfig } from 'antd';
import type { ColorMode } from './stores/themeStore';

export const palette = {
  primary: '#4ab72b',
  primaryInk: '#34801e',
  primarySoft: '#f0f9ec',
  primaryMuted: '#b4dfa6',
  text: '#252525',
  secondary: '#595959',
  border: '#e8e8e8',
  page: '#fafafa',
  surface: '#ffffff',
  surfaceMuted: '#f5f5f5',
  hover: '#f5faf2',
  selectedHover: '#e6f4df',
};

const darkPalette = {
  ...palette,
  primaryInk: '#91dd76',
  primarySoft: '#23351d',
  primaryMuted: '#315527',
  text: '#f0f0f0',
  secondary: '#c2c2c2',
  border: '#383838',
  page: '#141414',
  surface: '#1f1f1f',
  surfaceMuted: '#262626',
  hover: '#283522',
  selectedHover: '#2d4225',
};

function createTheme(mode: ColorMode): ThemeConfig {
  const colors = mode === 'dark' ? darkPalette : palette;
  return {
    algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    cssVar: { key: `bird-theme-${mode}` },

    token: {
      colorPrimary: colors.primary,
      colorSuccess: colors.primary,
      colorTextBase: colors.text,
      colorTextSecondary: colors.secondary,
      colorLink: colors.primaryInk,
      colorLinkHover: colors.primary,
      colorBgLayout: colors.page,
      colorBgContainer: colors.surface,
      colorBgElevated: colors.surface,
      colorBorder: colors.border,
      colorBorderSecondary: colors.border,
      colorFillAlter: colors.surfaceMuted,
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 16,
      borderRadius: 4,
      borderRadiusLG: 16,
    },
    components: {
      Card: {
        headerFontSize: 32,
        headerHeight: 96,
        headerPadding: 32,
        bodyPadding: 32,
        borderRadiusLG: 16,
      },
      Layout: {
        headerBg: colors.surface,
        headerColor: colors.text,
        bodyBg: colors.page,
      },
      Form: {
        itemMarginBottom: 28,
        labelFontSize: 18,
        verticalLabelPadding: '0 0 6px',
      },
      Input: {
        inputFontSizeLG: 18,
        paddingBlockLG: 10,
      },
      Button: {
        contentFontSizeLG: 18,
        primaryShadow: 'none',
        defaultShadow: 'none',
      },
      Modal: {
        borderRadiusLG: 16,
        titleColor: colors.text,
      },
      Drawer: {
        colorBgElevated: colors.surface,
      },
      Tabs: {
        itemSelectedColor: colors.primaryInk,
        itemHoverColor: colors.primaryInk,
        inkBarColor: colors.primary,
      },
      Tag: {
        defaultBg: colors.surfaceMuted,
        defaultColor: colors.secondary,
      },
      Table: {
        borderColor: colors.border,
        cellFontSize: 14,
        cellFontSizeMD: 14,
        cellPaddingBlockMD: 10,
        cellPaddingInlineMD: 14,
        headerBg: colors.surfaceMuted,
        // The table section owns the corners, including tables without a header.
        headerBorderRadius: 0,
        headerColor: colors.secondary,
        rowExpandedBg: colors.page,
        rowHoverBg: colors.hover,
        rowSelectedBg: colors.primarySoft,
        rowSelectedHoverBg: colors.selectedHover,
      },
    },
  };
}

export const themes = { light: createTheme('light'), dark: createTheme('dark') };
