export type ActionCategoryCode = "A" | "B" | "C" | "D" | "E";

export type TimeStudyActionDefinition = {
  subNo: number;
  categoryCode: ActionCategoryCode;
  categoryName: string;
  actionName: string;
  isOther?: boolean;
};

export const TIME_STUDY_ACTIONS: TimeStudyActionDefinition[] = [
  { subNo: 1, categoryCode: "A", categoryName: "直接介護", actionName: "移動・移乗・体位交換" },
  { subNo: 2, categoryCode: "A", categoryName: "直接介護", actionName: "排泄介助・支援" },
  { subNo: 3, categoryCode: "A", categoryName: "直接介護", actionName: "入浴・整容・更衣" },
  { subNo: 4, categoryCode: "A", categoryName: "直接介護", actionName: "利用者とのコミュニケーション" },
  { subNo: 5, categoryCode: "A", categoryName: "直接介護", actionName: "日常生活自立支援" },
  { subNo: 6, categoryCode: "A", categoryName: "直接介護", actionName: "行動上の問題への対応" },
  { subNo: 7, categoryCode: "A", categoryName: "直接介護", actionName: "食事支援" },
  { subNo: 8, categoryCode: "A", categoryName: "直接介護", actionName: "機能訓練・リハビリテーション・医療的処置" },
  { subNo: 9, categoryCode: "A", categoryName: "直接介護", actionName: "その他の直接介護", isOther: true },
  { subNo: 10, categoryCode: "B", categoryName: "間接業務", actionName: "巡回・移動" },
  { subNo: 11, categoryCode: "B", categoryName: "間接業務", actionName: "記録・文書作成・連絡調整等" },
  { subNo: 12, categoryCode: "B", categoryName: "間接業務", actionName: "利用者のアセスメント・情報収集・介護計画の作成・見直し" },
  { subNo: 13, categoryCode: "B", categoryName: "間接業務", actionName: "見守り機器の使用・確認" },
  { subNo: 14, categoryCode: "B", categoryName: "間接業務", actionName: "介護ロボット・ICT機器の準備・調整・片付け" },
  { subNo: 15, categoryCode: "B", categoryName: "間接業務", actionName: "他の職員に対する指導・教育" },
  { subNo: 16, categoryCode: "B", categoryName: "間接業務", actionName: "食事・おやつの配膳・下膳等" },
  { subNo: 17, categoryCode: "B", categoryName: "間接業務", actionName: "入浴業務の準備等" },
  { subNo: 18, categoryCode: "B", categoryName: "間接業務", actionName: "リネン交換・ベッドメイク" },
  { subNo: 19, categoryCode: "B", categoryName: "間接業務", actionName: "居室清掃・片付け" },
  { subNo: 20, categoryCode: "B", categoryName: "間接業務", actionName: "消毒などの感染症対応" },
  { subNo: 21, categoryCode: "B", categoryName: "間接業務", actionName: "その他の間接業務", isOther: true },
  { subNo: 22, categoryCode: "C", categoryName: "休憩", actionName: "休憩・待機・仮眠" },
  { subNo: 23, categoryCode: "D", categoryName: "その他", actionName: "その他", isOther: true },
  { subNo: 24, categoryCode: "E", categoryName: "余裕時間", actionName: "余裕時間（突発対応可能状態）" },
];

