import { useRef, useCallback } from "react";

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
}

export const useLongPress = ({
  onLongPress,
  onClick,
  delay = 500,
}: UseLongPressOptions) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Prevent default to avoid text selection on long press
      e.preventDefault();
      isLongPress.current = false;

      timerRef.current = setTimeout(() => {
        isLongPress.current = true;
        onLongPress();
      }, delay);
    },
    [onLongPress, delay]
  );

  const stop = useCallback(
    (_e: React.TouchEvent | React.MouseEvent) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Only trigger onClick if it wasn't a long press
      if (!isLongPress.current && onClick) {
        onClick();
      }
    },
    [onClick]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: stop,
    onTouchCancel: cancel,
  };
};
