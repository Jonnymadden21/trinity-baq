import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

interface Props {
  onToken: (token: string) => void;
  onError?: () => void;
}

export function TurnstileWidget({ onToken, onError }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
    if (!ref.current || !sitekey) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || !ref.current) return;
      widgetIdRef.current = window.turnstile.render(ref.current, {
        sitekey,
        callback: (t) => onToken(t),
        "error-callback": () => onError?.(),
        "expired-callback": () => onError?.(),
        appearance: "interaction-only",
        theme: "dark",
      });
    };
    if (window.turnstile) render();
    else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          render();
        }
      }, 100);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, [onToken, onError]);

  return <div ref={ref} />;
}
