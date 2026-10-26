import type { ThemeConfig } from 'antd';

export const theme: ThemeConfig = {
  cssVar: { key: 'auth-theme' },

  token: {
    colorPrimary: '#4ab72b',
    colorTextBase: '#252525',
    colorLink: '#4ab72b',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: 16,
    borderRadius: 4,
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
      headerBg: "#ffffff",
      headerColor: "#252525",
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
  },
};