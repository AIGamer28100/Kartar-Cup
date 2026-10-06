import { createContext, createElement, useContext, useState } from 'react';
import type { ReactNode } from 'react';
export type RaceState =
  | 'scheduled'
  | 'lights-out-sequence'
  | 'lights-out-countdown'
  | 'in-progress'
  | 'yellow-flag'
  | { type: 'yellow-flag-sector'; sector: 1 | 2 | 3 }
  | 'red-flag'
  | 'virtual-safety-car'
  | 'last-lap'
  | 'chequered-flag'
  | 'completed'
  | 'cancelled-by-host';

export type RaceStateContextValue = {
  state: RaceState;
  setState: (state: RaceState) => void;
  backgroundClass: string;
};

const defaultValue: RaceStateContextValue = {
  state: 'scheduled',
  setState: () => {},
  backgroundClass: '',
};

const RaceStateContext = createContext<RaceStateContextValue>(defaultValue);

export const useRaceState = (): RaceStateContextValue => {
  const context = useContext(RaceStateContext);
  if (!context) {
    return defaultValue;
  }
  return context;
};

export const RaceStateProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<RaceState>('scheduled');

  const { class: backgroundClass } = getBackgroundConfig(state);

  return createElement(
    RaceStateContext.Provider,
    { value: { state, setState, backgroundClass } },
    children
  );
};

export const getBackgroundConfig = (state: RaceState): { class: string; backgroundImage: string } => {
  const type = typeof state === 'object' ? state.type : state;

  const configs: Record<string, { class: string; backgroundImage: string }> = {
    scheduled: {
      class: 'bg-gradient-scheduled',
      backgroundImage: 'linear-gradient(135deg, #6474DB 0%, #2E3A89 100%)',
    },
    'lights-out-sequence': {
      class: 'bg-gradient-start',
      backgroundImage: 'linear-gradient(135deg, #F6AD55 0%, #DD6B20 100%)',
    },
    'lights-out-countdown': {
      class: 'bg-gradient-countdown',
      backgroundImage: 'linear-gradient(135deg, #FF8C42 0%, #E05F2F 100%)',
    },
    'in-progress': {
      class: 'bg-gradient-racing',
      backgroundImage: 'linear-gradient(135deg, #06B6D4 0%, #00A8E8 100%)',
    },
    'yellow-flag': {
      class: 'bg-gradient-yellow-flag',
      backgroundImage: 'linear-gradient(135deg, #F6E05E 0%, #FBBF24 100%)',
    },
    'yellow-flag-sector': {
      class: 'bg-gradient-yellow-sector',
      backgroundImage: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
    },
    'red-flag': {
      class: 'bg-gradient-red-flag',
      backgroundImage: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    },
    'virtual-safety-car': {
      class: 'bg-gradient-vsc',
      backgroundImage: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    },
    'last-lap': {
      class: 'bg-gradient-last-lap',
      backgroundImage: 'linear-gradient(135deg, #84CC16 0%, #65D90D 100%)',
    },
    'chequered-flag': {
      class: 'bg-gradient-chequered',
      backgroundImage: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    },
    completed: {
      class: 'bg-gradient-completed',
      backgroundImage: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    },
    'cancelled-by-host': {
      class: 'bg-gradient-cancelled',
      backgroundImage: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
    },
    unknown: {
      class: 'bg-gradient-unknown',
      backgroundImage: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
    },
    upcoming: {
      class: 'bg-gradient-upcoming',
      backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
    },
  };

  const config = configs[type] || configs.unknown;

  return {
    class: config.class,
    backgroundImage: config.backgroundImage,
  };
};

export default RaceStateContext;