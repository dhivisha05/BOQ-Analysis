import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { motionEase } from '../lib/motion';

function formatCounter(value, decimals, prefix, suffix) {
  return `${prefix}${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
}

export default function AnimatedCounter({
  value = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}) {
  const shouldReduceMotion = useReducedMotion();
  const targetValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const [displayValue, setDisplayValue] = useState(targetValue);
  const latestValue = useRef(targetValue);

  useEffect(() => {
    latestValue.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(targetValue);
      return undefined;
    }

    const controls = animate(latestValue.current, targetValue, {
      duration: 0.9,
      ease: motionEase.smooth,
      onUpdate: (nextValue) => {
        setDisplayValue(nextValue);
      },
    });

    return () => controls.stop();
  }, [shouldReduceMotion, targetValue]);

  return (
    <span className={className}>
      {formatCounter(displayValue, decimals, prefix, suffix)}
    </span>
  );
}
