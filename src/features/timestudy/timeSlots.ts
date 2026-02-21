export const SLOT_MINUTES = 10;
export const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
export const TOTAL_HOURS = 24;
export const TOTAL_SLOTS = TOTAL_HOURS * SLOTS_PER_HOUR;

export type SlotInfo = {
  index: number;
  hour: number;
  minuteFrom: number;
  minuteTo: number;
};

export function buildDaySlots(): SlotInfo[] {
  const slots: SlotInfo[] = [];
  for (let i = 0; i < TOTAL_SLOTS; i += 1) {
    const totalMinutes = i * SLOT_MINUTES;
    const hour = Math.floor(totalMinutes / 60);
    const minuteFrom = totalMinutes % 60;
    const minuteTo = minuteFrom + SLOT_MINUTES - 1;
    slots.push({ index: i, hour, minuteFrom, minuteTo });
  }
  return slots;
}

export function toSlotIndex(date: Date): number {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(minutes / SLOT_MINUTES)));
}

export function slotLabel(slot: SlotInfo): string {
  const from = String(slot.minuteFrom).padStart(2, "0");
  const to = String(slot.minuteTo).padStart(2, "0");
  return `${from}-${to}`;
}

