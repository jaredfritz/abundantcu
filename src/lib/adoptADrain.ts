/**
 * Shared constants and types for /adopt-a-drain, a front end on the City of Champaign's Adopt-a-Drain program.
 *
 * Everything here is safe to ship to the browser. The server side (talking to the City's ArcGIS services) lives in
 * adoptADrain.server.ts.
 */

export const CITY_PROGRAM_URL = "https://champaignil.gov/adoptadrain";
export const CITY_APP_URL = "https://gisweb.champaignil.gov/webapps/all/adoptadrain/";
export const CITY_WAIVER_URL =
  "https://cityofchampaign.sharepoint.com/:w:/g/EXXPO2o4NwlNgTow86oRWdUB7M2l74n2aKUpwsmxgzYpmw";

/** The page path the City's sign-in emails link back to. */
export const ADOPT_PAGE_PATH = "/adopt-a-drain";

/** The City's Nickname field holds 50 characters. */
export const NICKNAME_MAX = 50;

export type DrainAction = "adopt" | "release" | "clean" | "rename";

/**
 * One drain as sent to the browser: [objectId, lng, lat, adopted (0|1), nickname, cityId, adoptedAt, cleanedAt].
 * The adopter's user ID is never included: it's half of their sign-in credentials.
 */
export type DrainRow = [number, number, number, 0 | 1, string | null, string | null, number | null, number | null];

export interface DrainsResponse {
  drains: DrainRow[];
  fetchedAt: number;
}

export interface MyDrain {
  id: number;
  nickname: string | null;
  cityId: string | null;
  adoptedAt: number | null;
  cleanedAt: number | null;
  lng: number;
  lat: number;
}

export interface SessionResponse {
  signedIn: boolean;
  email?: string | null;
  myDrains?: MyDrain[];
}

export function drainTitle(nickname: string | null, cityId: string | null, objectId: number): string {
  if (nickname && nickname.trim()) return nickname.trim();
  return cityId ? `Drain ${cityId}` : `Drain #${objectId}`;
}

/** The City's Waiver of Liability, word for word as its Adopt-a-Drain app shows it to new users. */
export const WAIVER_TITLE = "ADOPT-A-DRAIN PROGRAM WAIVER OF LIABILITY AND RELEASE OF CLAIMS";
export const WAIVER_PARAGRAPHS: { text: string; strong?: boolean }[] = [
  {
    text: "The Adopt-a-Drain Program utilizes volunteers to clean storm drains on designated portions of streets and highways within the City of Champaign.",
  },
  {
    strong: true,
    text: "WARNING:  PARTICIPATION IN THE PROGRAM, INCLUDING, BUT NOT LIMITED TO, REMOVAL OF DEBRIS FROM THE STORM DRAIN AREA IS CONSIDERED HAZARDOUS ACTIVITY EVEN THOUGH CONDUCTED IN A SAFE, CONTROLLED MANNER.  THE CITY MAKES NO REPRESENTATIONS THAT ANY OF ITS AGENTS OR EMPLOYEES WILL BE PRESENT TO MONITOR THE MANNER IN WHICH WORK IS PERFORMED, AND IT IS LIKELY THAT NO CITY AGENT OR EMPLOYEE WILL BE PRESENT.  AN ACCIDENT OR INJURY CAN OCCUR TO ANYONE PRESENT, AND THE CITY ACCEPTS NO RESPONSIBILITY FOR SUCH ACCIDENTS OR INJURIES.  THE CITY OF CHAMPAIGN HAS NO KNOWLEDGE OF, AND UNDERTAKES NO RESPONSIBILITY FOR, THE TRAINING OR EXPERIENCE LEVELS OF PERSONS WHO MAY BE PARTICIPANTS IN THE PROGRAM, OR THE TYPES OF MATERIALS OR CONDITIONS THAT MAY BE ENCOUNTERED BY PARTICIPANTS.",
  },
  {
    text: "I have read the warning above, and I hereby release and discharge the City of Champaign, the State of Illinois, and their officers, agents, and employees, from any and all claims and liability for injuries or property damage of whatever kind I may sustain arising out of or in connection with the Adopt-a-Drain program, unless caused solely by the gross negligence or willful misconduct of the City of Champaign, State of Illinois, or their officers, employees, or agents.",
  },
  { text: "I voluntarily accept all risks, whether described above or not, associated with such activity." },
  {
    text: "I hereby covenant to hold the City of Champaign and its officers, employees, and agents, harmless from, defend and indemnify the same for any claims, judgments, or expenses, including but not limited to attorneys’ fees and costs of any suit which may be incurred by the City of Champaign or its officers or employees, arising out of my activities or presence in the Adopt-a-Drain Program.",
  },
  {
    text: "I hereby certify that I do not, to the best of my knowledge, have any physical limitations which would be aggravated by participating in such activities.  I certify that I am not currently taking any form of drugs which would interfere with such activities and that I will refrain from using any equipment in an unsafe manner or any equipment that I am not familiar with or which I do not know how to use safely.",
  },
  {
    text: "I am not and will not be under the influence of drugs, alcohol, or other intoxicants at the time I sign this Agreement or at any time while performing Adopt-a-Drain activities.",
  },
  { text: "No oral representations or inducements of any kind have been made to me on which I rely to sign this Waiver and Release." },
  { text: "I am eighteen years of age or older." },
  {
    text: "I have read and understand all of this Waiver of Liability and Release of Claims Form, and by accepting below, indicate my voluntary concurrence with its terms.  I accept this on behalf of myself and anyone claiming any interest through me or on my behalf, including anyone under the age of eighteen years old who is performing any Adopt-a-Drain activities under my supervision.",
  },
];
