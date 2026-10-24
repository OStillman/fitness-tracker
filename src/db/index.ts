import Dexie, { type Table } from 'dexie';
import type { Session } from '../types';

export class FitnessDB extends Dexie {
  sessions!: Table<Session, string>;

  constructor() {
    super('FitnessTrackerDB');
    this.version(1).stores({
      sessions: 'id, date, kind, done, updatedAt, syncStatus'
    });
  }
}

export const db = new FitnessDB();

// Helper to format Date to YYYY-MM-DD
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Generate demo data for instant visualization test
export async function loadDemoData(): Promise<void> {
  const sampleSessions: Session[] = [];
  const today = new Date();
  
  // Seed past 12 weeks of data
  for (let w = 12; w >= 0; w--) {
    const monday = new Date(today);
    monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) - (w * 7));

    const tue = new Date(monday); tue.setDate(monday.getDate() + 1);
    const thu = new Date(monday); thu.setDate(monday.getDate() + 3);
    const sat = new Date(monday); sat.setDate(monday.getDate() + 5);
    const sun = new Date(monday); sun.setDate(monday.getDate() + 6);

    // Tuesday Brizfit
    sampleSessions.push({
      id: `seed-tue-${w}`,
      date: formatDate(tue),
      kind: 'brizfit',
      done: true,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    });

    // Thursday: either Brizfit or TRT swap
    if (w === 3 || w === 7) {
      sampleSessions.push({
        id: `seed-thu-${w}`,
        date: formatDate(thu),
        kind: 'brizfit',
        done: false,
        swapped_for: 'trt',
        notes: 'TRT meeting',
        updatedAt: Date.now(),
        syncStatus: 'pending'
      });
      // Make-up on Wednesday!
      const wed = new Date(monday); wed.setDate(monday.getDate() + 2);
      sampleSessions.push({
        id: `seed-wed-${w}`,
        date: formatDate(wed),
        kind: 'brizfit',
        done: true,
        notes: 'Made up for TRT night',
        updatedAt: Date.now(),
        syncStatus: 'pending'
      });
    } else {
      sampleSessions.push({
        id: `seed-thu-${w}`,
        date: formatDate(thu),
        kind: 'brizfit',
        done: true,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      });
    }

    // Saturday: Parkrun or Brizfit
    if (w % 4 === 0) {
      const venues = ['Ashton Court', 'Eastville', 'Blaise Castle', 'Pomphrey Hill'];
      const venue = venues[w % venues.length];
      const baseSecs = 1480 - (12 - w) * 12; // Gradual PB improvement
      sampleSessions.push({
        id: `seed-sat-${w}`,
        date: formatDate(sat),
        kind: 'parkrun',
        done: true,
        parkrun: {
          eventName: venue,
          timeSeconds: baseSecs,
          position: 45 + w
        },
        updatedAt: Date.now(),
        syncStatus: 'pending'
      });
    } else {
      sampleSessions.push({
        id: `seed-sat-${w}`,
        date: formatDate(sat),
        kind: 'brizfit',
        done: true,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      });
    }

    // Sunday Ride or Walk
    if (w % 2 === 0) {
      sampleSessions.push({
        id: `seed-sun-ride-${w}`,
        date: formatDate(sun),
        kind: 'cycle',
        done: true,
        activity: {
          kind: 'cycle',
          distanceKm: 28.5 + (w * 1.5),
          durationMin: 72
        },
        updatedAt: Date.now(),
        syncStatus: 'pending'
      });
    } else {
      sampleSessions.push({
        id: `seed-sun-walk-${w}`,
        date: formatDate(sun),
        kind: 'walk',
        done: true,
        activity: {
          kind: 'walk',
          distanceKm: 5.2,
          durationMin: 55
        },
        updatedAt: Date.now(),
        syncStatus: 'pending'
      });
    }
  }

  await db.sessions.bulkPut(sampleSessions);
}
