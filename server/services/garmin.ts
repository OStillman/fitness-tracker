import { db } from '../db';
import type { PlanWorkout, WorkoutStep, WorkoutSubStep } from '../../src/types';

/**
 * Garmin Connect Integration Service
 * Manages SSO authentication, MFA challenges, session tokens,
 * and push/schedule of structured running workouts.
 */

interface GarminAuthRecord {
  id: string;
  user_id: string;
  username?: string;
  token_json?: string;
  mfa_ticket?: string;
  mfa_prompt?: string;
  last_sync_time?: number;
  updated_at: number;
}

interface StoredSession {
  cookies: Record<string, string>;
  username: string;
  displayName?: string;
}

// Garmin Sport & Step Type Keys
const GARMIN_SPORT_RUNNING = { sportTypeId: 1, sportTypeKey: 'running' };

const GARMIN_STEP_TYPES: Record<string, { stepTypeId: number; stepTypeKey: string }> = {
  warmup: { stepTypeId: 1, stepTypeKey: 'warmup' },
  cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown' },
  interval: { stepTypeId: 3, stepTypeKey: 'interval' },
  recovery: { stepTypeId: 4, stepTypeKey: 'recovery' },
  steady: { stepTypeId: 3, stepTypeKey: 'interval' },
  rest: { stepTypeId: 5, stepTypeKey: 'rest' }
};

export class GarminService {
  private userId: string;

  constructor(userId: string = 'default_user') {
    this.userId = userId;
  }

  /**
   * Get current Garmin connection status
   */
  public getStatus(): { isConnected: boolean; username?: string; lastSyncTime?: number } {
    const row = db
      .prepare('SELECT * FROM garmin_auth WHERE user_id = ?')
      .get(this.userId) as GarminAuthRecord | undefined;

    if (!row || !row.token_json) {
      return { isConnected: false };
    }

    try {
      const session = JSON.parse(row.token_json) as StoredSession;
      return {
        isConnected: Object.keys(session.cookies || {}).length > 0,
        username: session.username || row.username,
        lastSyncTime: row.last_sync_time
      };
    } catch {
      return { isConnected: false };
    }
  }

  /**
   * Disconnect Garmin account and purge stored credentials
   */
  public disconnect(): void {
    db.prepare('DELETE FROM garmin_auth WHERE user_id = ?').run(this.userId);
  }

  /**
   * Helper to format cookie header from cookie map
   */
  private formatCookieHeader(cookies: Record<string, string>): string {
    return Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  /**
   * Parse Set-Cookie headers into dictionary
   */
  private parseSetCookies(headers: Headers, existingCookies: Record<string, string> = {}): Record<string, string> {
    const cookies = { ...existingCookies };
    const getSetCookie = (headers as any).getSetCookie?.bind(headers);
    let cookieList: string[] = [];

    if (typeof getSetCookie === 'function') {
      cookieList = getSetCookie();
    } else {
      const raw = headers.get('set-cookie');
      if (raw) cookieList = [raw];
    }

    for (const c of cookieList) {
      const parts = c.split(';')[0].split('=');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        cookies[name] = value;
      }
    }

    return cookies;
  }

  /**
   * Step 1: Initiate Garmin Login
   */
  public async login(email: string, pass: string): Promise<{
    success: boolean;
    requiresMfa?: boolean;
    mfaPrompt?: string;
    error?: string;
  }> {
    try {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      let cookies: Record<string, string> = {};

      // 1. Initial GET to fetch CSRF token and initial cookies
      const ssoEmbedUrl =
        'https://sso.garmin.com/sso/embed?service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&webhost=https%3A%2F%2Fconnect.garmin.com&source=https%3A%2F%2Fconnect.garmin.com%2Fsignin&redirectAfterAccountLoginUrl=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&redirectAfterAccountCreationUrl=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&locale=en_US&id=gauth-widget&cssUrl=https%3A%2F%2Fconnect.garmin.com%2Fgauth-custom-v1.2-min.css&privacyStatementUrl=https%3A%2F%2Fwww.garmin.com%2Fen-US%2Fprivacy%2Fconnect%2F&clientId=GarminConnect&rememberMeShown=true&rememberMeChecked=true&createAccountShown=true&openCreateAccount=false&displayNameShown=false&consumeServiceTicket=false&initialDisplay=first_page';

      const embedRes = await fetch(ssoEmbedUrl, {
        headers: {
          'User-Agent': userAgent
        }
      });

      cookies = this.parseSetCookies(embedRes.headers, cookies);
      const embedHtml = await embedRes.text();

      // Extract CSRF token
      const csrfMatch = embedHtml.match(/name="_csrf"\s+value="([^"]+)"/i);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';

      // 2. POST credentials
      const signinUrl =
        'https://sso.garmin.com/sso/signin?service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&webhost=https%3A%2F%2Fconnect.garmin.com&source=https%3A%2F%2Fconnect.garmin.com%2Fsignin&redirectAfterAccountLoginUrl=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&redirectAfterAccountCreationUrl=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&locale=en_US&id=gauth-widget&cssUrl=https%3A%2F%2Fconnect.garmin.com%2Fgauth-custom-v1.2-min.css&privacyStatementUrl=https%3A%2F%2Fwww.garmin.com%2Fen-US%2Fprivacy%2Fconnect%2F&clientId=GarminConnect&rememberMeShown=true&rememberMeChecked=true&createAccountShown=true&openCreateAccount=false&displayNameShown=false&consumeServiceTicket=false&initialDisplay=first_page';

      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', pass);
      formData.append('embed', 'true');
      formData.append('_csrf', csrfToken);
      formData.append('rememberMe', 'on');

      const signinRes = await fetch(signinUrl, {
        method: 'POST',
        headers: {
          'User-Agent': userAgent,
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: this.formatCookieHeader(cookies),
          Referer: ssoEmbedUrl
        },
        body: formData.toString()
      });

      cookies = this.parseSetCookies(signinRes.headers, cookies);
      const signinHtml = await signinRes.text();

      // Check if MFA is required
      if (signinHtml.includes('mfa-code') || signinHtml.includes('verifyMFA') || signinHtml.includes('two-step')) {
        const mfaCsrf = signinHtml.match(/name="_csrf"\s+value="([^"]+)"/i)?.[1] || csrfToken;
        const now = Date.now();

        db.prepare(`
          INSERT INTO garmin_auth (id, user_id, username, token_json, mfa_ticket, mfa_prompt, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            username = excluded.username,
            token_json = excluded.token_json,
            mfa_ticket = excluded.mfa_ticket,
            mfa_prompt = excluded.mfa_prompt,
            updated_at = excluded.updated_at
        `).run(
          this.userId,
          this.userId,
          email,
          JSON.stringify({ cookies, email }),
          mfaCsrf,
          'Please enter the 6-digit verification code sent to your email or authenticator app.',
          now
        );

        return {
          success: true,
          requiresMfa: true,
          mfaPrompt: 'A 6-digit security code was requested by Garmin. Please enter it below.'
        };
      }

      // Check for ticket response
      const ticketMatch = signinHtml.match(/ticket=([^"']+)/i);
      if (ticketMatch && ticketMatch[1]) {
        // Exchange ticket for modern session
        await this.exchangeTicket(ticketMatch[1], cookies, email);
        return { success: true };
      }

      if (signinHtml.includes('Invalid sign in') || signinHtml.includes('username or password')) {
        return { success: false, error: 'Invalid Garmin email or password.' };
      }

      // If cookies have session ID, store session
      if (cookies['SESSIONID'] || cookies['GARMIN-SSO-GUID']) {
        this.saveSession(email, cookies);
        return { success: true };
      }

      return {
        success: false,
        error: 'Unable to authenticate with Garmin Connect. Check credentials.'
      };
    } catch (err: any) {
      console.error('[GarminService] Login error:', err);
      return { success: false, error: err.message || 'Garmin authentication failed' };
    }
  }

  /**
   * Step 2: Submit 2FA/MFA Code
   */
  public async submitMfaCode(code: string): Promise<{ success: boolean; error?: string }> {
    try {
      const row = db
        .prepare('SELECT * FROM garmin_auth WHERE user_id = ?')
        .get(this.userId) as GarminAuthRecord | undefined;

      if (!row || !row.token_json || !row.mfa_ticket) {
        return { success: false, error: 'No pending MFA session found. Please try logging in again.' };
      }

      const session = JSON.parse(row.token_json);
      let cookies: Record<string, string> = session.cookies || {};
      const csrfToken = row.mfa_ticket;

      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      const mfaUrl = 'https://sso.garmin.com/sso/verifyMFA/sendCode';
      const formData = new URLSearchParams();
      formData.append('mfa-code', code.trim());
      formData.append('_csrf', csrfToken);
      formData.append('embed', 'true');

      const res = await fetch(mfaUrl, {
        method: 'POST',
        headers: {
          'User-Agent': userAgent,
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: this.formatCookieHeader(cookies),
          Referer: 'https://sso.garmin.com/sso/verifyMFA'
        },
        body: formData.toString()
      });

      cookies = this.parseSetCookies(res.headers, cookies);
      const text = await res.text();

      const ticketMatch = text.match(/ticket=([^"']+)/i);
      if (ticketMatch && ticketMatch[1]) {
        await this.exchangeTicket(ticketMatch[1], cookies, row.username || 'Garmin User');
        return { success: true };
      }

      if (cookies['SESSIONID'] || cookies['GARMIN-SSO-GUID']) {
        this.saveSession(row.username || 'Garmin User', cookies);
        return { success: true };
      }

      return { success: false, error: 'Invalid verification code. Please check and try again.' };
    } catch (err: any) {
      console.error('[GarminService] MFA submit error:', err);
      return { success: false, error: err.message || 'MFA verification failed' };
    }
  }

  /**
   * Exchange SSO service ticket for connect.garmin.com session cookies
   */
  private async exchangeTicket(ticket: string, cookies: Record<string, string>, username: string): Promise<void> {
    const exchangeUrl = `https://connect.garmin.com/modern/?ticket=${encodeURIComponent(ticket)}`;
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const res = await fetch(exchangeUrl, {
      headers: {
        'User-Agent': userAgent,
        Cookie: this.formatCookieHeader(cookies)
      },
      redirect: 'follow'
    });

    const updatedCookies = this.parseSetCookies(res.headers, cookies);
    this.saveSession(username, updatedCookies);
  }

  /**
   * Save authenticated session
   */
  private saveSession(username: string, cookies: Record<string, string>): void {
    const now = Date.now();
    const sessionData: StoredSession = {
      cookies,
      username
    };

    db.prepare(`
      INSERT INTO garmin_auth (id, user_id, username, token_json, mfa_ticket, mfa_prompt, last_sync_time, updated_at)
      VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        token_json = excluded.token_json,
        mfa_ticket = NULL,
        mfa_prompt = NULL,
        last_sync_time = excluded.last_sync_time,
        updated_at = excluded.updated_at
    `).run(this.userId, this.userId, username, JSON.stringify(sessionData), now, now);
  }

  /**
   * Format our structured workout into Garmin Connect native Workout JSON
   */
  public formatGarminWorkout(workout: PlanWorkout, paceEnforcement: 'pace' | 'hr'): any {
    let stepOrderCounter = 1;

    const buildStep = (s: WorkoutStep | WorkoutSubStep): any => {
      const stepType = GARMIN_STEP_TYPES[s.stepType] || GARMIN_STEP_TYPES.interval;

      // End condition (Distance or Time)
      let endCondition = { conditionTypeId: 1, conditionTypeKey: 'lap.button' };
      let endConditionValue: any = null;

      if (s.durationType === 'distance' && s.durationValue > 0) {
        endCondition = { conditionTypeId: 3, conditionTypeKey: 'distance' };
        endConditionValue = s.durationValue; // in meters
      } else if (s.durationType === 'time' && s.durationValue > 0) {
        endCondition = { conditionTypeId: 2, conditionTypeKey: 'time' };
        endConditionValue = s.durationValue; // in seconds
      }

      // Target (Pace, HR, or Open)
      let targetType = { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' };
      let targetValueLow = null;
      let targetValueHigh = null;

      if (s.targetType === 'pace' && s.targetLow && s.targetHigh && paceEnforcement === 'pace') {
        targetType = { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' };
        targetValueLow = s.targetLow; // speed m/s
        targetValueHigh = s.targetHigh;
      }

      return {
        type: 'ExecutableStepDTO',
        stepId: null,
        stepOrder: stepOrderCounter++,
        stepType,
        childStepId: null,
        endCondition,
        endConditionValue,
        endConditionCompare: null,
        targetType,
        targetValueOne: targetValueLow,
        targetValueTwo: targetValueHigh,
        description: s.description || s.name
      };
    };

    const garminSteps: any[] = [];

    for (const step of workout.steps) {
      if (step.repeatCount && step.repeatCount > 1 && step.repeatSteps && step.repeatSteps.length > 0) {
        // Repeat Group
        const repeatStepId = stepOrderCounter++;
        const childSteps: any[] = [];
        for (const child of step.repeatSteps) {
          childSteps.push(buildStep(child));
        }

        garminSteps.push({
          type: 'RepeatGroupDTO',
          stepId: repeatStepId,
          stepOrder: repeatStepId,
          stepType: { stepTypeId: 6, stepTypeKey: 'repeat' },
          numberOfIterations: step.repeatCount,
          workoutSteps: childSteps,
          smartRepeat: false
        });
      } else {
        garminSteps.push(buildStep(step));
      }
    }

    return {
      workoutName: workout.title,
      description: workout.description,
      sportType: GARMIN_SPORT_RUNNING,
      subSportType: null,
      workoutSegments: [
        {
          segmentOrder: 1,
          sportType: GARMIN_SPORT_RUNNING,
          workoutSteps: garminSteps
        }
      ]
    };
  }

  /**
   * Push workout to Garmin Connect and schedule it on the user's calendar
   */
  public async scheduleWorkout(workout: PlanWorkout, paceEnforcement: 'pace' | 'hr'): Promise<string> {
    const row = db
      .prepare('SELECT * FROM garmin_auth WHERE user_id = ?')
      .get(this.userId) as GarminAuthRecord | undefined;

    if (!row || !row.token_json) {
      throw new Error('Garmin Connect account is not connected.');
    }

    const session: StoredSession = JSON.parse(row.token_json);
    const cookies = session.cookies;
    const cookieHeader = this.formatCookieHeader(cookies);

    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const garminPayload = this.formatGarminWorkout(workout, paceEnforcement);

    // 1. Post workout to Garmin Workout Service
    const workoutRes = await fetch('https://connect.garmin.com/workout-service/workout', {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        NK: 'NT'
      },
      body: JSON.stringify(garminPayload)
    });

    if (!workoutRes.ok) {
      const errText = await workoutRes.text();
      console.error('[GarminService] Workout creation failed:', workoutRes.status, errText);
      throw new Error(`Garmin rejected workout creation (${workoutRes.status})`);
    }

    const workoutData = (await workoutRes.json()) as any;
    const garminWorkoutId = String(workoutData.workoutId);

    // 2. Schedule workout on user's calendar
    const scheduleRes = await fetch(`https://connect.garmin.com/workout-service/schedule/${garminWorkoutId}`, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        NK: 'NT'
      },
      body: JSON.stringify({ date: workout.scheduledDate })
    });

    if (!scheduleRes.ok) {
      console.warn('[GarminService] Workout schedule returned non-200:', scheduleRes.status);
    }

    // Update SQLite workout
    db.prepare(`
      UPDATE plan_workouts
      SET garmin_workout_id = ?, garmin_sync_status = 'synced', garmin_sync_error = NULL, updated_at = ?
      WHERE id = ?
    `).run(garminWorkoutId, Date.now(), workout.id);

    return garminWorkoutId;
  }
}
