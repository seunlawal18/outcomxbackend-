"use client";
import { useState, useEffect } from "react";

type Direction = "up" | "down" | "top";

/**
 * Returns the current scroll direction.
 * "top"  — page is at or near the top (< threshold px)
 * "up"   — user is scrolling upward
 * "down" — user is scrolling downward
 */
export function useScrollDirection(threshold = 8): Direction {
  const [direction, setDirection] = useState<Direction>("top");

  useEffect(() => {
    let lastY = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;

      if (y < 60) {
        setDirection("top");
      } else if (y < lastY - threshold) {
        setDirection("up");
      } else if (y > lastY + threshold) {
        setDirection("down");
      }

      lastY = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return direction;
}
