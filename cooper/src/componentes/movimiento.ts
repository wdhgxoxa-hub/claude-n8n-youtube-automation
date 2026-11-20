"use client";
import { useContext } from "react";
import { MotionConfigContext, useReducedMotion } from "framer-motion";
export function useMovimientoReducido() {
  const reduced = useReducedMotion();
  const config = useContext(MotionConfigContext);
  return reduced || config.reducedMotion === "always";
}
