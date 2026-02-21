export type HeaderCellMapping = {
  key: string;
  label: string;
  cell: string;
  description: string;
};

export const OFFICIAL_TEMPLATE_NAME = "職員向けタイムスタディ調査票.xlsx";
export const OFFICIAL_TEMPLATE_PATH = "/templates/official-template.xlsx";
export const OFFICIAL_TEMPLATE_SHEET_NAME = "別添４ TS調査票";

export const HEADER_CELL_MAPPINGS: HeaderCellMapping[] = [
  { key: "facilityName", label: "施設名", cell: "H2", description: "設定画面Aの施設名" },
  { key: "unitName", label: "ユニット・フロア名", cell: "S2", description: "設定画面Aのユニット・フロア名" },
  { key: "staffCode", label: "職員ID", cell: "H3", description: "設定画面Aの職員ID" },
  { key: "surveyDate", label: "調査実施日", cell: "H4", description: "設定画面Cの調査日" },
  { key: "scheduledWorkTime", label: "所定勤務時間", cell: "S3", description: "設定画面Aで設定した勤務時間" },
  { key: "actualWorkTime", label: "実勤務時間", cell: "S4", description: "実績ログの最小開始〜最大終了（自動計算）" },
  { key: "remarksTop", label: "備考（上段）", cell: "D35", description: "設定画面Cの備考" },
  { key: "remarksBottom", label: "備考（下段）", cell: "D69", description: "設定画面Cの備考" },
];

export type TimeGridMapping = {
  subNo: number;
  block1Row: number;
  block2Row: number;
};

export const TIME_GRID_MAPPINGS: TimeGridMapping[] = Array.from({ length: 24 }, (_, i) => ({
  subNo: i + 1,
  block1Row: 11 + i,
  block2Row: 45 + i,
}));

export const BLOCK_TIME_COLUMNS = [
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "AA",
  "AB",
  "AC",
  "AD",
  "AE",
  "AF",
  "AG",
  "AH",
  "AI",
  "AJ",
  "AK",
  "AL",
  "AM",
  "AN",
  "AO",
] as const;

export const HOUR_LABEL_CELLS_BLOCK1 = ["F9", "L9", "R9", "X9", "AD9", "AJ9"] as const;
export const HOUR_LABEL_CELLS_BLOCK2 = ["F43", "L43", "R43", "X43", "AD43", "AJ43"] as const;
