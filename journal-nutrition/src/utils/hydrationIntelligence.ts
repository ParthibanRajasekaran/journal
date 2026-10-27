/**
 * Smart Hydration Intelligence Engine
 * Analyzes daily intake progress against circadian hydration milestones
 * and generates biological prompts when trailing behind schedule.
 */

export interface HydrationPaceAnalysis {
  currentMl: number;
  targetMl: number;
  expectedMl: number;
  deficitMl: number;
  percentGoal: number;
  status: 'ahead' | 'on_track' | 'lagging' | 'completed';
  timeSlotName: string;
  headline: string;
  biologicalReason: string;
  promptAction: string;
}

export function analyzeHydrationPace(
  currentMl: number,
  targetMl: number = 2500,
  overrideHour?: number
): HydrationPaceAnalysis {
  const hour = overrideHour !== undefined ? overrideHour : new Date().getHours();
  const percentGoal = Math.round((currentMl / Math.max(1, targetMl)) * 100);

  if (currentMl >= targetMl) {
    return {
      currentMl,
      targetMl,
      expectedMl: targetMl,
      deficitMl: 0,
      percentGoal,
      status: 'completed',
      timeSlotName: 'Goal Met',
      headline: 'Hydration Target Achieved! 🏆',
      biologicalReason: 'Optimal cellular fluid volume achieved. Kidney filtration and thermoregulation are running at peak capacity.',
      promptAction: 'Sip intuitively as thirst dictates.',
    };
  }

  // Determine expected milestone based on time of day
  let expectedRatio = 0.2;
  let timeSlotName = 'Morning Rise';
  let biologicalReason = 'Morning hydration flushes overnight metabolic byproducts and activates gastric motility.';

  if (hour < 9) {
    expectedRatio = 0.15;
    timeSlotName = 'Early Morning';
    biologicalReason = 'After 7+ hours of fasting, intracellular fluid levels need immediate restoration to clear brain fog.';
  } else if (hour >= 9 && hour < 12) {
    expectedRatio = 0.35;
    timeSlotName = 'Morning Focus';
    biologicalReason = 'Mild morning dehydration drops cognitive acuity and increases perceived effort during daily tasks.';
  } else if (hour >= 12 && hour < 15) {
    expectedRatio = 0.55;
    timeSlotName = 'Midday Peak';
    biologicalReason = 'Water is essential for digestive enzymes and nutrient absorption from lunch, avoiding postprandial fatigue.';
  } else if (hour >= 15 && hour < 18) {
    expectedRatio = 0.75;
    timeSlotName = 'Afternoon Slump Shield';
    biologicalReason = 'The 3 PM energy slump is frequently subclinical dehydration rather than true caloric deficit.';
  } else if (hour >= 18 && hour < 21) {
    expectedRatio = 0.9;
    timeSlotName = 'Evening Foundation';
    biologicalReason = 'Hydrating 2 hours before bed supports overnight lymphatic drainage without disrupting deep sleep cycles.';
  } else {
    expectedRatio = 1.0;
    timeSlotName = 'Night Wind-Down';
    biologicalReason = 'Gentle sips maintain mucosal barrier hydration without overloading bladder capacity.';
  }

  const expectedMl = Math.round(targetMl * expectedRatio);
  const deficitMl = Math.max(0, expectedMl - currentMl);

  if (deficitMl > 250) {
    return {
      currentMl,
      targetMl,
      expectedMl,
      deficitMl,
      percentGoal,
      status: 'lagging',
      timeSlotName,
      headline: `Trailing Behind Hydration Pace (${deficitMl} ml gap)`,
      biologicalReason,
      promptAction: `Drink a glass of water now (+250 ml) to close your ${deficitMl} ml deficit.`,
    };
  } else if (currentMl >= expectedMl + 200) {
    return {
      currentMl,
      targetMl,
      expectedMl,
      deficitMl: 0,
      percentGoal,
      status: 'ahead',
      timeSlotName,
      headline: `Ahead of Hydration Schedule! ✨`,
      biologicalReason: 'Superb pacing! Maintaining steady fluids prevents blood volume fluctuations and anchors steady focus.',
      promptAction: 'Keep up your rhythmic sips throughout the day.',
    };
  } else {
    return {
      currentMl,
      targetMl,
      expectedMl,
      deficitMl: 0,
      percentGoal,
      status: 'on_track',
      timeSlotName,
      headline: `Right on Track (${percentGoal}% completed)`,
      biologicalReason: 'Your hydration intake aligns smoothly with circadian metabolic expenditure.',
      promptAction: 'Keep a water bottle nearby to maintain this cadence.',
    };
  }
}

/**
 * Dispatches a native browser notification if granted by the user.
 */
export async function sendHydrationNotification(analysis: HydrationPaceAnalysis) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    new Notification(analysis.headline, {
      body: `${analysis.promptAction}\n${analysis.biologicalReason}`,
      icon: '/pwa-192x192.png',
      badge: '/icon.svg',
    });
  } else if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification(analysis.headline, {
        body: `${analysis.promptAction}\n${analysis.biologicalReason}`,
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
      });
    }
  }
}
