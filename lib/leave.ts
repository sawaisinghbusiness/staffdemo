import type { Bi } from "./i18n";

export type LeaveType = "sick" | "family" | "casual" | "other";

export const LEAVE_TYPES: Record<LeaveType, Bi> = {
  sick: { hi: "बीमारी", en: "Sick" },
  family: { hi: "घर का काम / शादी", en: "Family function" },
  casual: { hi: "ज़रूरी काम", en: "Casual" },
  other: { hi: "दूसरा कारण", en: "Other" },
};
