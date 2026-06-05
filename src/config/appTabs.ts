export type AppTabId = "A" | "B" | "C" | "D";

export type AppTabDefinition = {
  id: AppTabId;
  shortLabel: string;
  fullLabel: string;
  panelId: string;
};

export const APP_TABS: AppTabDefinition[] = [
  { id: "A", shortLabel: "設定", fullLabel: "画面A 設定", panelId: "tabpanel-settings" },
  { id: "B", shortLabel: "記録", fullLabel: "画面B ログ入力", panelId: "tabpanel-input" },
  { id: "C", shortLabel: "提出", fullLabel: "画面C 提出チェック", panelId: "tabpanel-sheet" },
  { id: "D", shortLabel: "分析", fullLabel: "画面D DX改善提案", panelId: "tabpanel-analysis" },
];
