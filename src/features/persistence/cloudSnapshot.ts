import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CloudSnapshot = {
  staffs: Array<{ id: string; name: string; staffCode: string }>;
  presets: Array<{ id: string; name: string; startMinutes: number; endMinutes: number }>;
  selectedStaffId: string;
  workHourStart: number | null;
  workHourEnd: number | null;
  surveyDateIso: string;
  exportMeta: {
    facilityName: string;
    unitName: string;
    staffCode: string;
    surveyDate: string;
    remarks: string;
  };
  logs: Array<{
    id: string;
    staffId: string;
    actionSubNo?: number;
    actionName?: string;
    startTime: string;
    endTime?: string;
    memo?: string;
    isPending: boolean;
  }>;
  manualGridValues: Record<string, number>;
};

const SNAPSHOT_TABLE = "app_snapshots";

function getSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon) return null;
  return createClient(url, anon, { auth: { persistSession: false } });
}

function getSnapshotId(): string {
  return (import.meta.env.VITE_SUPABASE_SNAPSHOT_ID as string | undefined) ?? "default";
}

export function isCloudSyncEnabled(): boolean {
  return getSupabaseClient() !== null;
}

export async function loadCloudSnapshot(): Promise<CloudSnapshot | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const id = getSnapshotId();
  const { data, error } = await client
    .from(SNAPSHOT_TABLE)
    .select("payload")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload || typeof data.payload !== "object") return null;
  return data.payload as CloudSnapshot;
}

export async function saveCloudSnapshot(snapshot: CloudSnapshot): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const id = getSnapshotId();
  const { error } = await client.from(SNAPSHOT_TABLE).upsert({ id, payload: snapshot }, { onConflict: "id" });
  if (error) throw error;
}
