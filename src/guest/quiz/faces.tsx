import { createContext, useContext, useEffect, useState } from 'react';
import { BASE, getJson } from '../../lib/openf1';
import { EMPTY_FACES, parseFaces, type DriverFace } from './grid';

let inflight: Promise<Map<string, DriverFace>> | null = null;
/** One shared fetch of the latest session's drivers; failures resolve to no faces (initials show instead). */
function loadFaces(): Promise<Map<string, DriverFace>> {
  inflight ||= getJson(`${BASE}/drivers?session_key=latest`).then(parseFaces).catch(() => EMPTY_FACES);
  return inflight;
}

/** Lets a harness / test supply faces without the network. */
export const FacesContext = createContext<Map<string, DriverFace> | null>(null);

export function useFaces(): Map<string, DriverFace> {
  const supplied = useContext(FacesContext);
  const [faces, setFaces] = useState(EMPTY_FACES);
  useEffect(() => {
    if (supplied) return;
    let live = true;
    void loadFaces().then((f) => {
      if (live) setFaces(f);
    });
    return () => {
      live = false;
    };
  }, [supplied]);
  return supplied ?? faces;
}
