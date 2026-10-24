import type { SuggestedRunWorkout, WorkoutCategory } from '../types';

interface WorkoutTemplate {
  id: string;
  title: string;
  category: WorkoutCategory;
  categoryLabel: string;
  source: string;
  sourceAuthor: string;
  sourceCredentials: string;
  summary: string;
  whyItWorks: string;
  targetEffort: string;
  coachingTips: string[];
  generator: (maxKm: number) => {
    totalKm: number;
    durationMin: number;
    phases: { name: string; distanceKm?: number; durationMin?: number; description: string }[];
  };
}

const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  // 1. Jack Daniels E-Pace Easy Run
  {
    id: 'daniels-easy-base',
    title: 'Daniels Conversational Aerobic Base',
    category: 'easy',
    categoryLabel: 'Easy & Base',
    source: "Daniels' Running Formula (4th Edition)",
    sourceAuthor: 'Jack Daniels, Ph.D.',
    sourceCredentials: 'Olympic Medalist Coach & Exercise Physiologist, VDOT System Pioneer',
    summary: 'A steady, conversational Zone 2 run designed to build cellular aerobic capacity without fatigue.',
    whyItWorks: 'Dr. Daniels demonstrates that running at 65-79% HRmax produces near-maximal improvements in capillary density and mitochondrial enzymes in skeletal muscle, while preserving joint tissues and keeping cortisol low.',
    targetEffort: 'RPE 3-4 (Conversational Pace / Zone 2: 65-79% HRmax)',
    coachingTips: [
      'You should be able to speak full sentences comfortably without gasping.',
      'Maintain a light, quick cadence (around 170-180 steps/min).',
      'If your heart rate creeps up on hills, slow down or walk — do not force a fast pace.'
    ],
    generator: (maxKm: number) => {
      // 80% to 100% of max distance
      const totalKm = Math.max(2, Math.round(maxKm * 0.9 * 10) / 10);
      const estMin = Math.round(totalKm * 6.0); // ~6:00/km average
      return {
        totalKm,
        durationMin: estMin,
        phases: [
          {
            name: 'Warm-up',
            distanceKm: Math.round(totalKm * 0.15 * 10) / 10,
            description: 'Start at a very gentle jog to lubricate joints and raise body temperature gradually.'
          },
          {
            name: 'Steady Base',
            distanceKm: Math.round(totalKm * 0.75 * 10) / 10,
            description: 'Settle into smooth, rhythmic breathing (3 steps in, 3 steps out). Keep effort conversational.'
          },
          {
            name: 'Cool-down',
            distanceKm: Math.round(totalKm * 0.10 * 10) / 10,
            description: 'Easy jog to walk, followed by dynamic calf and hip flexor stretches.'
          }
        ]
      };
    }
  },

  // 2. Jack Daniels 400m Track Intervals (I-Pace)
  {
    id: 'daniels-intervals-400',
    title: 'Daniels 400m VO₂ Max Intervals',
    category: 'interval',
    categoryLabel: 'Intervals & Speed',
    source: "Daniels' Running Formula",
    sourceAuthor: 'Jack Daniels, Ph.D.',
    sourceCredentials: 'Coached multiple Olympians; world authority on oxygen uptake kinetics',
    summary: 'Classic 400-meter repetitions at 5K race pace designed to expand maximum aerobic power (VO₂ Max).',
    whyItWorks: 'Running in intervals at your current VO₂ max velocity (approx 5K pace) challenges cardiac output. The equal or near-equal recovery jog ensures lactate is cleared before the next repetition starts.',
    targetEffort: 'RPE 8-9 (Zone 4-5: 95-100% HRmax on intervals)',
    coachingTips: [
      'Resist sprinting the first 100 meters of each interval; hit a smooth, controlled 5K rhythm.',
      'Take full advantage of the recovery jog/walk — your goal is quality repeats, not surviving exhaustion.',
      'Focus on upright posture, driving your knees forward rather than overstriding.'
    ],
    generator: (maxKm: number) => {
      const warmup = Math.min(1.2, Math.round(maxKm * 0.25 * 10) / 10);
      const cooldown = Math.min(1.0, Math.round(maxKm * 0.20 * 10) / 10);
      const availableForSets = Math.max(1.2, maxKm - warmup - cooldown);
      // Each set is 400m (0.4km) fast + 200m (0.2km) jog = 0.6km
      const reps = Math.max(3, Math.min(10, Math.floor(availableForSets / 0.6)));
      const intervalWorkKm = Math.round(reps * 0.6 * 10) / 10;
      const totalKm = Math.round((warmup + intervalWorkKm + cooldown) * 10) / 10;
      const durationMin = Math.round(warmup * 6.5 + reps * 3.5 + cooldown * 6.5);

      return {
        totalKm,
        durationMin,
        phases: [
          {
            name: 'Warm-up & Drills',
            distanceKm: warmup,
            description: `${warmup} km very easy jog, followed by 3 dynamic drills (high knees, butt kicks, leg swings) and 2 light 50m accelerations.`
          },
          {
            name: `Main Set: ${reps} × 400m Intervals`,
            distanceKm: intervalWorkKm,
            description: `${reps} sets of 400m at 5K race effort (controlled fast), with 200m very slow recovery jog or walking between each repetition.`
          },
          {
            name: 'Cool-down Jog',
            distanceKm: cooldown,
            description: `${cooldown} km light jog to flush out lactic acid, followed by full quad, hamstring, and Achilles stretching.`
          }
        ]
      };
    }
  },

  // 3. Jack Daniels 200m Neuromuscular Repetitions (Sprint Sessions)
  {
    id: 'daniels-sprint-reps',
    title: 'Daniels 200m Neuromuscular Strides & Sprints',
    category: 'sprint',
    categoryLabel: 'Sprint Sessions',
    source: "Daniels' Running Formula (Repetition Pace System)",
    sourceAuthor: 'Jack Daniels, Ph.D.',
    sourceCredentials: 'Former Olympic Modern Pentathlete, PhD in Exercise Physiology',
    summary: 'Fast, crisp 200-meter repetitions with generous 200m walk recoveries to train top-end mechanics without acid burnout.',
    whyItWorks: 'Dr. Daniels separates Repetition (R) training from Interval training: the work bouts are brief (<45s) and recoveries are full, allowing phosphagen (ATP-CP) replenishment. This sharpens neuromuscular motor unit recruitment and stride economy without building heavy blood lactate.',
    targetEffort: 'RPE 9 (Crisp & Fast, 95% speed, relaxed form)',
    coachingTips: [
      'Run tall, relax your shoulders and jaw, and pump your arms compactly back and forth.',
      'Walk the 200m recovery so you are fully caught your breath before each sprint.',
      'Do not strain for 100% all-out effort — aim for 95% fast and butter-smooth.'
    ],
    generator: (maxKm: number) => {
      const warmup = Math.min(1.5, Math.round(maxKm * 0.3 * 10) / 10);
      const cooldown = Math.min(1.0, Math.round(maxKm * 0.2 * 10) / 10);
      const availableForSets = Math.max(1.0, maxKm - warmup - cooldown);
      // Each set is 200m (0.2km) sprint + 200m (0.2km) walk = 0.4km
      const reps = Math.max(4, Math.min(10, Math.floor(availableForSets / 0.4)));
      const workKm = Math.round(reps * 0.4 * 10) / 10;
      const totalKm = Math.round((warmup + workKm + cooldown) * 10) / 10;
      const durationMin = Math.round(warmup * 6 + reps * 3 + cooldown * 6);

      return {
        totalKm,
        durationMin,
        phases: [
          {
            name: 'Warm-up & Mobility',
            distanceKm: warmup,
            description: `${warmup} km easy jog + dynamic leg swings and ankle mobility.`
          },
          {
            name: `Main Set: ${reps} × 200m Strides / Sprints`,
            distanceKm: workKm,
            description: `${reps} × 200m sprints at crisp mile pace / 95% effort, followed by 200m slow walk recovery after each.`
          },
          {
            name: 'Cool-down',
            distanceKm: cooldown,
            description: `${cooldown} km slow jog and walking recovery.`
          }
        ]
      };
    }
  },

  // 4. Jack Daniels Lactate Threshold Cruise Intervals
  {
    id: 'daniels-threshold-cruise',
    title: 'Daniels Lactate Threshold (Cruise Intervals)',
    category: 'tempo',
    categoryLabel: 'Tempo & Threshold',
    source: "Daniels' Running Formula",
    sourceAuthor: 'Jack Daniels, Ph.D.',
    sourceCredentials: 'World leading exercise physiologist, creator of the VDOT training tables',
    summary: 'Sustained threshold segments at "comfortably hard" pace designed to push back your lactate fatigue threshold.',
    whyItWorks: 'Daniels demonstrated that running at your 60-minute race pace (88-92% HRmax) improves your body’s ability to clear lactate faster than it accumulates, allowing you to sustain high speed far longer in races.',
    targetEffort: 'RPE 7-8 ("Comfortably Hard" / Zone 4: 88-92% HRmax)',
    coachingTips: [
      'Pacing test: You should be able to speak short phrases ("good pace", "keep going"), but not hold a continuous conversation.',
      'Maintain an even split across every block — do not go out too fast.',
      'Keep your core braced and gaze 15-20 meters ahead.'
    ],
    generator: (maxKm: number) => {
      const warmup = Math.min(1.2, Math.round(maxKm * 0.25 * 10) / 10);
      const cooldown = Math.min(1.0, Math.round(maxKm * 0.2 * 10) / 10);
      const available = Math.max(1.5, maxKm - warmup - cooldown);
      // Blocks of 800m (0.8km) or 1km
      const blockKm = maxKm >= 7 ? 1.0 : 0.8;
      const reps = Math.max(2, Math.min(5, Math.floor(available / (blockKm + 0.2))));
      const workKm = Math.round(reps * (blockKm + 0.2) * 10) / 10;
      const totalKm = Math.round((warmup + workKm + cooldown) * 10) / 10;
      const durationMin = Math.round(warmup * 6.5 + reps * (blockKm * 4.8 + 1.5) + cooldown * 6.5);

      return {
        totalKm,
        durationMin,
        phases: [
          {
            name: 'Warm-up',
            distanceKm: warmup,
            description: `${warmup} km easy conversational jog + 2 light strides.`
          },
          {
            name: `Cruise Set: ${reps} × ${blockKm * 1000}m at Threshold`,
            distanceKm: workKm,
            description: `${reps} repetitions of ${blockKm * 1000}m at steady threshold pace ("comfortably hard"), with 60 to 90 seconds light jog recovery in between.`
          },
          {
            name: 'Cool-down',
            distanceKm: cooldown,
            description: `${cooldown} km relaxed recovery jog.`
          }
        ]
      };
    }
  },

  // 5. Hal Higdon Progressive Base Run
  {
    id: 'higdon-progressive-run',
    title: 'Hal Higdon Progressive 75/25 Run',
    category: 'tempo',
    categoryLabel: 'Tempo & Threshold',
    source: "Hal Higdon's Training Programs",
    sourceAuthor: 'Hal Higdon',
    sourceCredentials: 'Runner’s World Contributing Editor for 50+ yrs, author of 36 distance books',
    summary: 'A progressive continuous run starting at relaxed conversational pace and finishing the final quarter with a strong, confident acceleration.',
    whyItWorks: 'Higdon uses progressive runs to teach neuromuscular pacing discipline. Starting slowly ensures complete fat-oxidation warm-up, and finishing briskly recruits fast-twitch muscle fibers under fatigued conditions.',
    targetEffort: 'RPE 4 starting, progressing to RPE 7-8 for final 25%',
    coachingTips: [
      'Check your ego early: the first 2-3 km should feel deceptively easy.',
      'Gradually let your stride open up over the final quarter without straining.',
      'Finish strong and stand tall as you cross the final landmark.'
    ],
    generator: (maxKm: number) => {
      const totalKm = Math.max(3, Math.round(maxKm * 0.9 * 10) / 10);
      const easyPortion = Math.round(totalKm * 0.75 * 10) / 10;
      const fastPortion = Math.round((totalKm - easyPortion) * 10) / 10;
      const durationMin = Math.round(easyPortion * 6.0 + fastPortion * 4.8);

      return {
        totalKm,
        durationMin,
        phases: [
          {
            name: 'Phase 1: Conversational Base (75%)',
            distanceKm: easyPortion,
            description: `${easyPortion} km at a relaxed, comfortable Zone 2 pace. Breathe easily and find your rhythm.`
          },
          {
            name: 'Phase 2: Progressive Tempo Finish (25%)',
            distanceKm: fastPortion,
            description: `${fastPortion} km progressive acceleration. Gradually drop pace each 500m until you finish at 10K / threshold speed.`
          },
          {
            name: 'Cool-down Walk',
            description: '5 minutes walking recovery and gentle hamstring stretch.'
          }
        ]
      };
    }
  },

  // 6. Hal Higdon Hill Power Repeats
  {
    id: 'higdon-hill-power',
    title: 'Hal Higdon Hill Power Repeats',
    category: 'hills',
    categoryLabel: 'Hills & Strength',
    source: "Hal Higdon Marathon & Half-Marathon Training",
    sourceAuthor: 'Hal Higdon',
    sourceCredentials: 'Hall of Fame Distance Runner, Senior Writer for Runner’s World',
    summary: 'Explosive uphill surges on a moderate 6-8% grade with slow walking descents to build explosive leg power.',
    whyItWorks: 'Higdon famously advocates: "Hill training is speed work in disguise." Pushing uphill requires strong hip drive and calf power while eliminating the sharp knee impact force of downhill or flat sprint braking.',
    targetEffort: 'RPE 8-9 on uphill drive (Strong & Powerful)',
    coachingTips: [
      'Find a hill with a 6-8% slope (not a cliff). Keep your stride short and punchy.',
      'Drive your elbows back and pump your knees.',
      'Walk — do not jog — down the hill to protect your knees from eccentric impact.'
    ],
    generator: (maxKm: number) => {
      const warmup = Math.min(1.5, Math.round(maxKm * 0.3 * 10) / 10);
      const cooldown = Math.min(1.0, Math.round(maxKm * 0.2 * 10) / 10);
      const available = Math.max(1.0, maxKm - warmup - cooldown);
      // Each hill set is ~150m up + 150m walk down = ~0.3km
      const reps = Math.max(4, Math.min(8, Math.floor(available / 0.3)));
      const hillKm = Math.round(reps * 0.3 * 10) / 10;
      const totalKm = Math.round((warmup + hillKm + cooldown) * 10) / 10;
      const durationMin = Math.round(warmup * 6.5 + reps * 2.5 + cooldown * 6.5);

      return {
        totalKm,
        durationMin,
        phases: [
          {
            name: 'Warm-up to Hill',
            distanceKm: warmup,
            description: `${warmup} km easy jog to your training hill, plus glute activation drills.`
          },
          {
            name: `Main Set: ${reps} × Hill Sprints`,
            distanceKm: hillKm,
            description: `${reps} uphill drives (45-60 seconds each) with strong posture and knee lift. Walk down slowly between each rep for full recovery.`
          },
          {
            name: 'Cool-down Jog',
            distanceKm: cooldown,
            description: `${cooldown} km easy flat jog back home.`
          }
        ]
      };
    }
  },

  // 7. Gösta Holmér Swedish Classic Fartlek
  {
    id: 'holmer-swedish-fartlek',
    title: 'Gösta Holmér Swedish Classic Fartlek',
    category: 'fartlek',
    categoryLabel: 'Fartlek & Play',
    source: 'The Holmér Swedish Fartlek Method (1937)',
    sourceAuthor: 'Gösta Holmér',
    sourceCredentials: 'Swedish Olympic Team Coach, Father of Modern Speed Play',
    summary: 'Unstructured continuous running blending natural bursts of speed between landmarks with relaxed rolling recovery.',
    whyItWorks: 'Created in 1937 to train Swedish world-record breakers Gunder Hägg and Arne Andersson. Fartlek ("speed play" in Swedish) teaches your cardiovascular system to recover while still running continuously.',
    targetEffort: 'RPE 4 during float recovery, alternating with RPE 8-9 on surges',
    coachingTips: [
      'Pick natural landmarks (trees, lamp posts, street corners) as your sprint targets.',
      'Never stop to walk during the recovery — float smoothly at an easy jog.',
      'Have fun and play with different surge lengths (from 15s bursts to 2-minute sustained pushes).'
    ],
    generator: (maxKm: number) => {
      const totalKm = Math.max(3, Math.round(maxKm * 0.85 * 10) / 10);
      const warmup = Math.round(totalKm * 0.25 * 10) / 10;
      const fartlekKm = Math.round(totalKm * 0.55 * 10) / 10;
      const cooldown = Math.round((totalKm - warmup - fartlekKm) * 10) / 10;
      const durationMin = Math.round(totalKm * 5.6);

      return {
        totalKm,
        durationMin,
        phases: [
          {
            name: 'Warm-up',
            distanceKm: warmup,
            description: `${warmup} km gentle continuous jogging.`
          },
          {
            name: 'Main Fartlek: Speed Play',
            distanceKm: fartlekKm,
            description: `${fartlekKm} km alternating between quick surges (30s to 90s to next landmark) and relaxed floating recovery jogs.`
          },
          {
            name: 'Cool-down',
            distanceKm: cooldown,
            description: `${cooldown} km slow jog to lower heart rate.`
          }
        ]
      };
    }
  },

  // 8. Nike Run Club Pyramid Interval Speed Session
  {
    id: 'nrc-pyramid-speed',
    title: 'NRC Pyramid Interval Speed Session',
    category: 'interval',
    categoryLabel: 'Intervals & Speed',
    source: 'Nike Run Club Guided Workouts',
    sourceAuthor: 'Coach Chris Bennett',
    sourceCredentials: 'Nike Running Global Head Coach & Master Trainer',
    summary: 'A time-based pyramid session (1-2-3-2-1 min) that tests different speed gears and pacing strategies.',
    whyItWorks: 'Pyramid interval structures challenge both neuromuscular rate of force development during short intervals and aerobic lactic buffering during longer blocks.',
    targetEffort: 'RPE 7-9 (Zone 4-5 on speed segments, RPE 3 on rest)',
    coachingTips: [
      'The 1-min intervals should be fast (5K pace or faster).',
      'The 3-min interval at the peak of the pyramid requires steady, controlled 10K pace.',
      'Celebrate when you reach the top of the pyramid — the way down is faster!'
    ],
    generator: (maxKm: number) => {
      const warmup = Math.min(1.2, Math.round(maxKm * 0.25 * 10) / 10);
      const cooldown = Math.min(1.0, Math.round(maxKm * 0.2 * 10) / 10);
      const available = Math.max(1.5, maxKm - warmup - cooldown);
      // Pyramid: 1m, 2m, 3m, 2m, 1m = 9 min hard work + 8 min jog = 17 min ≈ 2.8 km
      // If maxKm is smaller, do shorter pyramid (1m, 2m, 1m)
      const isShort = available < 2.5;
      const workKm = isShort ? 1.6 : Math.min(available, 3.2);
      const totalKm = Math.round((warmup + workKm + cooldown) * 10) / 10;
      const durationMin = Math.round(warmup * 6.5 + (isShort ? 16 : 24) + cooldown * 6.5);

      return {
        totalKm,
        durationMin,
        phases: [
          {
            name: 'Warm-up',
            distanceKm: warmup,
            description: `${warmup} km comfortable jog + 2 x 20-second strides.`
          },
          {
            name: isShort ? 'Mini Pyramid (1-2-1 min)' : 'Full Pyramid (1-2-3-2-1 min)',
            distanceKm: workKm,
            description: isShort
              ? '1 min fast / 1 min easy jog, 2 min strong / 2 min easy jog, 1 min fast finish.'
              : '1 min fast / 1 min easy, 2 min strong / 1 min easy, 3 min peak effort / 2 min easy, 2 min strong / 1 min easy, 1 min fastest finish.'
          },
          {
            name: 'Cool-down',
            distanceKm: cooldown,
            description: `${cooldown} km easy jog and recovery breathing.`
          }
        ]
      };
    }
  },

  // 9. UK Athletics Negative Split Endurance Session
  {
    id: 'uka-negative-split',
    title: 'UK Athletics Negative Split Builder',
    category: 'tempo',
    categoryLabel: 'Tempo & Threshold',
    source: 'UK Athletics / England Athletics Endurance Coaching Syllabus',
    sourceAuthor: 'UK Athletics Coaching',
    sourceCredentials: 'UK National Governing Body for Track & Field and Endurance Running',
    summary: 'Run an out-and-back course where the return half is intentionally run faster than the outward journey.',
    whyItWorks: 'Negative splitting is the gold-standard racing tactic of elite world-record holders. It conserves intramuscular glycogen in the opening stages and conditions mental toughness to pass runners when legs are tired.',
    targetEffort: 'Outward: RPE 4 (Zone 2) | Return: RPE 6-7 (Zone 3-4 Steady)',
    coachingTips: [
      'Hit your turnaround landmark at an honest conversational pace.',
      'On the return leg, increase your cadence by 3-5% and shorten your ground contact time.',
      'Target finishing the return leg 15 to 30 seconds faster per kilometer than the way out.'
    ],
    generator: (maxKm: number) => {
      const totalKm = Math.max(3, Math.round(maxKm * 0.95 * 10) / 10);
      const outKm = Math.round((totalKm / 2) * 10) / 10;
      const backKm = Math.round((totalKm - outKm) * 10) / 10;
      const durationMin = Math.round(outKm * 6.0 + backKm * 5.2);

      return {
        totalKm,
        durationMin,
        phases: [
          {
            name: 'Outward Leg (Controlled Easy)',
            distanceKm: outKm,
            description: `${outKm} km out at conversational aerobic pace. Note landmarks along the path.`
          },
          {
            name: 'Return Leg (Negative Split Pace)',
            distanceKm: backKm,
            description: `${backKm} km back, accelerating to steady tempo pace. Aim to complete this half noticeably faster than the first!`
          },
          {
            name: 'Cool-down',
            description: '5 minutes easy walking and quad stretch.'
          }
        ]
      };
    }
  }
];

export function getSuggestedWorkouts(
  maxDistanceKm: number = 5,
  categoryFilter?: WorkoutCategory | 'all'
): SuggestedRunWorkout[] {
  const effectiveMaxKm = Math.max(2, Math.min(50, maxDistanceKm));

  const filtered = categoryFilter && categoryFilter !== 'all'
    ? WORKOUT_TEMPLATES.filter((t) => t.category === categoryFilter)
    : WORKOUT_TEMPLATES;

  return filtered.map((template) => {
    const generated = template.generator(effectiveMaxKm);
    return {
      id: `${template.id}-${effectiveMaxKm}k`,
      title: template.title,
      category: template.category,
      categoryLabel: template.categoryLabel,
      source: template.source,
      sourceAuthor: template.sourceAuthor,
      sourceCredentials: template.sourceCredentials,
      summary: template.summary,
      whyItWorks: template.whyItWorks,
      targetEffort: template.targetEffort,
      totalDistanceKm: generated.totalKm,
      estimatedDurationMin: generated.durationMin,
      phases: generated.phases,
      coachingTips: template.coachingTips
    };
  });
}
