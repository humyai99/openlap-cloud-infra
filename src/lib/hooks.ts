"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, waitForJob } from "@/lib/api/client";
import type { Instance, InstanceType, Job, PowerAction } from "@/lib/types";

/** Loads instances from the API with loading / error state and background refresh. */
export function useInstances(type?: InstanceType, refreshMs = 4000) {
  const [data, setData] = useState<Instance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await api.listInstances(type));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [type]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void reload();
    const t = setInterval(reload, refreshMs);
    return () => clearInterval(t);
  }, [reload, refreshMs]);

  return { data, error, reload, loading: data === null && !error };
}

const POWER_MSG: Record<PowerAction, string> = { start: "started", stop: "stopped", restart: "restarted", shutdown: "shut down" };

/** Runs a job-returning API call, tracks it and shows toasts. */
export async function runJob(start: () => Promise<Job>, messages: { loading: string; success: string }, onDone?: () => void) {
  const id = toast.loading(messages.loading);
  try {
    const job = await start();
    onDone?.();
    const final = await waitForJob(job.id);
    if (final.status === "failed") throw new Error(final.error ?? "Operation failed");
    toast.success(messages.success, { id });
    onDone?.();
    return final;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Operation failed", { id });
    onDone?.();
    return null;
  }
}

export function usePowerAction(onDone?: () => void) {
  return (inst: Instance, action: PowerAction) =>
    runJob(
      () => api.power(inst.id, action),
      { loading: `${action[0].toUpperCase()}${action.slice(1)}ing ${inst.name}…`, success: `${inst.type === "vm" ? "VM" : "Container"} ${inst.name} ${POWER_MSG[action]}` },
      onDone,
    );
}
