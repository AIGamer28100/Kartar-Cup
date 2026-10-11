/** OpenF1 identifiers per calendar race id (the ids used in src/config/calendar). `meeting_key` is the weekend,
 * `circuit_key` the track; looking a Race session up by meeting_key is exact where matching on country and
 * locality was not (Bahrain/Kuala Lumpur, two US races, ...). Only races whose OpenF1 meeting exists are listed;
 * every entry was checked against api.openf1.org (scripts/check-openf1-ids.mjs). */
export interface OpenF1Ids {
  meetingKey: number;
  circuitKey: number;
}

export const OPENF1_IDS: Record<string, OpenF1Ids> = {
  '2026-r15-azerbaijan': { meetingKey: 1295, circuitKey: 144 },
  '2026-r16-malaysia': { meetingKey: 1308, circuitKey: 12 },
  '2026-r17-singapore': { meetingKey: 1296, circuitKey: 61 },
  '2026-r18-united-states': { meetingKey: 1297, circuitKey: 9 },
  '2026-r19-mexico': { meetingKey: 1298, circuitKey: 65 },
  '2026-r20-brazil': { meetingKey: 1299, circuitKey: 14 },
  '2026-r21-las-vegas': { meetingKey: 1300, circuitKey: 152 },
  '2026-r22-qatar': { meetingKey: 1301, circuitKey: 150 },
  '2026-r23-abu-dhabi': { meetingKey: 1302, circuitKey: 70 },
  '2027-r1-bahrain': { meetingKey: 1310, circuitKey: 63 },
  '2027-r2-saudi-arabia': { meetingKey: 1311, circuitKey: 149 },
  '2027-r3-australia': { meetingKey: 1312, circuitKey: 10 },
  '2027-r4-japan': { meetingKey: 1313, circuitKey: 46 },
  '2027-r5-china': { meetingKey: 1314, circuitKey: 49 },
  '2027-r6-miami': { meetingKey: 1315, circuitKey: 151 },
  '2027-r7-canada': { meetingKey: 1316, circuitKey: 23 },
  '2027-r8-monaco': { meetingKey: 1317, circuitKey: 22 },
  '2027-r9-portugal': { meetingKey: 1318, circuitKey: 147 },
  '2027-r10-great-britain': { meetingKey: 1319, circuitKey: 2 },
  '2027-r11-austria': { meetingKey: 1320, circuitKey: 19 },
  '2027-r12-belgium': { meetingKey: 1321, circuitKey: 7 },
  '2027-r13-hungary': { meetingKey: 1322, circuitKey: 4 },
  '2027-r14-italy': { meetingKey: 1323, circuitKey: 39 },
  '2027-r15-spain': { meetingKey: 1324, circuitKey: 153 },
  '2027-r16-azerbaijan': { meetingKey: 1325, circuitKey: 144 },
  '2027-r17-turkiye': { meetingKey: 1326, circuitKey: 59 },
  '2027-r18-singapore': { meetingKey: 1327, circuitKey: 61 },
  '2027-r19-united-states': { meetingKey: 1328, circuitKey: 9 },
  '2027-r20-mexico': { meetingKey: 1329, circuitKey: 65 },
  '2027-r21-brazil': { meetingKey: 1330, circuitKey: 14 },
  '2027-r22-las-vegas': { meetingKey: 1331, circuitKey: 152 },
  '2027-r23-qatar': { meetingKey: 1332, circuitKey: 150 },
  '2027-r24-abu-dhabi': { meetingKey: 1333, circuitKey: 70 },
};

/** The OpenF1 ids for a race id, or undefined when the race is not mapped yet. */
export const openF1IdsFor = (raceId: string): OpenF1Ids | undefined => OPENF1_IDS[raceId];
