"use client";

import { memo } from "react";
import { motion } from "framer-motion";

/**
 * EnergyStream Component
 *
 * Displays animated connection lines between tool execution cards during auto mode.
 * Shows flowing particles along a vertical path to visualize execution flow.
 */
export const EnergyStream = memo(function EnergyStream() {
  return (
    <div className="relative h-4 w-full flex items-center justify-center">
      {/* Vertical connecting line */}
      <motion.div
        className="absolute w-0.5 h-full bg-gradient-to-b from-transparent via-primary/40 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          times: [0, 0.5, 1]
        }}
      />

      {/* Flowing particles */}
      {[0, 0.5, 1].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_4px_1px_oklch(0.60_0.16_40/0.5)]"
          initial={{ y: "-100%", opacity: 0 }}
          animate={{
            y: "200%",
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay,
            ease: "easeInOut",
            times: [0, 0.2, 0.8, 1]
          }}
        />
      ))}
    </div>
  );
});
