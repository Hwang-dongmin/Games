import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/** Primary input has no hover (most phones / touch-first) */
export function useTouchPrimary() {
  const [touchPrimary, setTouchPrimary] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(hover: none)");
    const onChange = () => setTouchPrimary(mql.matches);
    mql.addEventListener("change", onChange);
    setTouchPrimary(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return touchPrimary;
}
