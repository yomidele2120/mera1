import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface StoryProgressProps {
  count: number;
  current: number;
  duration: number;
  isPaused: boolean;
  onComplete: () => void;
}

export const StoryProgress = ({
  count,
  current,
  duration,
  isPaused,
  onComplete,
}: StoryProgressProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
  }, [current]);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          onComplete();
          return 100;
        }
        return prev + 100 / (duration / 50);
      });
    }, 50);

    return () => clearInterval(interval);
  }, [current, isPaused, duration, onComplete]);

  return (
    <div className="flex gap-1 w-full px-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
        >
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{
              width:
                index < current
                  ? "100%"
                  : index === current
                  ? `${progress}%`
                  : "0%",
            }}
            transition={{ duration: 0.05 }}
          />
        </div>
      ))}
    </div>
  );
};
