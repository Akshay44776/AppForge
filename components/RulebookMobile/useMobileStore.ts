import { useSyncExternalStore } from "react";

export interface MobileStoreState {
  progress: number;
  openRuleId: number | null;
  orreryActive: boolean;
}

const initial: MobileStoreState = {
  progress: 0,
  openRuleId: null,
  orreryActive: false,
};

let state: MobileStoreState = initial;
const listeners = new Set<() => void>();

function set(patch: Partial<MobileStoreState>) {
  let changed = false;
  for (const k of Object.keys(patch) as (keyof MobileStoreState)[]) {
    if (state[k] !== patch[k]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => state;
const getServerSnapshot = () => initial;

export function useMobileStore<T>(selector: (s: MobileStoreState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getSnapshot()), () => selector(getServerSnapshot()));
}

export const mobileProgressRef = { current: 0 };

export const mobileStore = {
  get: getSnapshot,
  subscribe,
  setOpenRule(id: number | null) {
    set({ openRuleId: id });
  },
  setOrreryActive(v: boolean) {
    set({ orreryActive: v });
  }
};
