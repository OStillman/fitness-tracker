import type { VdotPaces } from '../types';

/**
 * Jack Daniels VDOT and Pacing Formulas (Gilbert & Daniels, 1979)
 */

/**
 * Format pace in seconds/km to "MM:SS"
 */
export function formatPaceMinSec(secondsPerKm: number): string {
  if (!secondsPerKm || isNaN(secondsPerKm) || secondsPerKm <= 0) return '0:00';
  const totalSecs = Math.round(secondsPerKm);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Convert pace in seconds/km to meters/second (for Garmin Workout targets)
 */
export function paceToMetersPerSecond(secondsPerKm: number): number {
  if (!secondsPerKm || secondsPerKm <= 0) return 0;
  return Math.round((1000 / secondsPerKm) * 100) / 100;
}

/**
 * Calculate VDOT from a race/benchmark performance
 * @param distanceMeters Distance in meters (e.g. 5000 for 5k)
 * @param timeSeconds Time in seconds (e.g. 1500 for 25:00)
 */
export function calculateVDOT(distanceMeters: number, timeSeconds: number): number {
  if (distanceMeters <= 0 || timeSeconds <= 0) return 30;

  const t = timeSeconds / 60; // minutes
  const v = distanceMeters / t; // meters per minute

  // Fraction of VO2max for race of duration t
  const percentVO2max =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * t) +
    0.2989558 * Math.exp(-0.1932605 * t);

  // Oxygen cost of running at velocity v
  const vo2Cost = -4.60 + 0.182258 * v + 0.000104 * Math.pow(v, 2);

  const vdot = vo2Cost / percentVO2max;
  return Math.round(vdot * 10) / 10;
}

/**
 * Calculate velocity in meters/min at a specific fraction of VDOT
 */
function getVelocityAtVO2(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -(vo2 + 4.60);

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return 150;

  return (-b + Math.sqrt(discriminant)) / (2 * a);
}

/**
 * Convert velocity (m/min) to pace (seconds/km)
 */
function velocityToSecondsPerKm(v: number): number {
  if (v <= 0) return 360;
  return (1000 / v) * 60;
}

/**
 * Derive physiological training pace zones from VDOT
 */
export function getVdotPaces(vdot: number): VdotPaces {
  const clampedVdot = Math.max(25, Math.min(85, vdot));

  // Easy Pace: ~62% - 74% VO2max
  const eLowV = getVelocityAtVO2(clampedVdot * 0.74);
  const eHighV = getVelocityAtVO2(clampedVdot * 0.62);
  const easyPaceSecs: [number, number] = [
    Math.round(velocityToSecondsPerKm(eLowV)),
    Math.round(velocityToSecondsPerKm(eHighV))
  ];

  // Marathon Pace: ~75% - 84% VO2max
  const mLowV = getVelocityAtVO2(clampedVdot * 0.84);
  const mHighV = getVelocityAtVO2(clampedVdot * 0.75);
  const marathonPaceSecs: [number, number] = [
    Math.round(velocityToSecondsPerKm(mLowV)),
    Math.round(velocityToSecondsPerKm(mHighV))
  ];

  // Threshold Pace: ~86% - 89% VO2max
  const tLowV = getVelocityAtVO2(clampedVdot * 0.89);
  const tHighV = getVelocityAtVO2(clampedVdot * 0.86);
  const thresholdPaceSecs: [number, number] = [
    Math.round(velocityToSecondsPerKm(tLowV)),
    Math.round(velocityToSecondsPerKm(tHighV))
  ];

  // Interval Pace: ~95% - 100% VO2max
  const iLowV = getVelocityAtVO2(clampedVdot * 1.0);
  const iHighV = getVelocityAtVO2(clampedVdot * 0.95);
  const intervalPaceSecs: [number, number] = [
    Math.round(velocityToSecondsPerKm(iLowV)),
    Math.round(velocityToSecondsPerKm(iHighV))
  ];

  // Repetition Pace: ~105% - 110% VO2max (anaerobic turnover)
  const rLowV = getVelocityAtVO2(clampedVdot * 1.1);
  const rHighV = getVelocityAtVO2(clampedVdot * 1.05);
  const repetitionPaceSecs: [number, number] = [
    Math.round(velocityToSecondsPerKm(rLowV)),
    Math.round(velocityToSecondsPerKm(rHighV))
  ];

  return {
    vdot: clampedVdot,
    easyPaceSecsPerKm: easyPaceSecs,
    marathonPaceSecsPerKm: marathonPaceSecs,
    thresholdPaceSecsPerKm: thresholdPaceSecs,
    intervalPaceSecsPerKm: intervalPaceSecs,
    repetitionPaceSecsPerKm: repetitionPaceSecs,
    easyDisplay: `${formatPaceMinSec(easyPaceSecs[0])} - ${formatPaceMinSec(easyPaceSecs[1])} /km`,
    marathonDisplay: `${formatPaceMinSec(marathonPaceSecs[0])} - ${formatPaceMinSec(marathonPaceSecs[1])} /km`,
    thresholdDisplay: `${formatPaceMinSec(thresholdPaceSecs[0])} - ${formatPaceMinSec(thresholdPaceSecs[1])} /km`,
    intervalDisplay: `${formatPaceMinSec(intervalPaceSecs[0])} - ${formatPaceMinSec(intervalPaceSecs[1])} /km`,
    repetitionDisplay: `${formatPaceMinSec(repetitionPaceSecs[0])} - ${formatPaceMinSec(repetitionPaceSecs[1])} /km`
  };
}

/**
 * Estimate race time for given distance (meters) using VDOT
 */
export function estimateRaceTime(vdot: number, distanceMeters: number): number {
  // Binary search time in seconds (from 1 min to 360 min)
  let low = 60;
  let high = 360 * 60;

  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const calc = calculateVDOT(distanceMeters, mid);
    if (calc > vdot) {
      // Faster time than target VDOT -> increase time
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.round((low + high) / 2);
}
