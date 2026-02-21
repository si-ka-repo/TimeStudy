import { TIME_STUDY_ACTIONS } from "../../config/timeStudyActions";

export const TIME_STUDY_CATEGORIES = [
  { code: "A", name: "直接介護", displayOrder: 1 },
  { code: "B", name: "間接業務", displayOrder: 2 },
  { code: "C", name: "休憩", displayOrder: 3 },
  { code: "D", name: "その他", displayOrder: 4 },
  { code: "E", name: "余裕時間", displayOrder: 5 },
] as const;

export const TIME_STUDY_ACTION_ITEMS = TIME_STUDY_ACTIONS.map((a) => ({
  subNo: a.subNo,
  categoryCode: a.categoryCode,
  name: a.actionName,
  isOther: Boolean(a.isOther),
}));

