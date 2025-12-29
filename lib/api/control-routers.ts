import {
  ControlRouter,
  FarmsRouter,
  KickstarterRouter,
  RegionRouter,
  WalletsRouter,
} from "@glowlabs-org/utils/browser";

export function getControlApiUrl(): string {
  // IMPORTANT: use direct access so Next can inline NEXT_PUBLIC_* on the client.
  const value = process.env.NEXT_PUBLIC_CONTROL_API_URL;
  if (!value)
    throw new Error(
      "Environment variable NEXT_PUBLIC_CONTROL_API_URL is not set"
    );
  return value;
}

type Routers = {
  controlRouter: ReturnType<typeof ControlRouter>;
  walletsRouter: ReturnType<typeof WalletsRouter>;
  farmsRouter: ReturnType<typeof FarmsRouter>;
  regionRouter: ReturnType<typeof RegionRouter>;
  kickstarterRouter: ReturnType<typeof KickstarterRouter>;
};

let cached: Routers | null = null;

export function getControlRouters(): Routers {
  // Important: avoid evaluating env vars at module import time (client runtime).
  if (cached) return cached;
  const CONTROL_API_URL = getControlApiUrl();
  cached = {
    controlRouter: ControlRouter(CONTROL_API_URL),
    walletsRouter: WalletsRouter(CONTROL_API_URL),
    farmsRouter: FarmsRouter(CONTROL_API_URL),
    regionRouter: RegionRouter(CONTROL_API_URL),
    kickstarterRouter: KickstarterRouter(CONTROL_API_URL),
  };
  return cached;
}

export const getControlRouter = () => getControlRouters().controlRouter;
export const getWalletsRouter = () => getControlRouters().walletsRouter;
export const getFarmsRouter = () => getControlRouters().farmsRouter;
export const getRegionRouter = () => getControlRouters().regionRouter;
export const getKickstarterRouter = () => getControlRouters().kickstarterRouter;
