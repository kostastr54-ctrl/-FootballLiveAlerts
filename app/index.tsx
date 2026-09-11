import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

const WORKER_URL =
  "https://old-sky-49f8.kostasstam1277.workers.dev";

const REFRESH_MS = 30000;

type Team = {
  id?: string | number;
  name?: string;
  logo?: string;
};

type StatsSide = {
  attacks?: number;
  dangerous_attacks?: number;
  shots?: number;
  shots_on_target?: number;
  shots_off_target?: number;
  corners?: number;
  possession?: number;
};

type Statistics = {
  attacks?: {
    home?: number;
    away?: number;
  };
  dangerous_attacks?: {
    home?: number;
    away?: number;
  };
  shots?: {
    home?: number;
    away?: number;
  };
  shots_on_target?: {
    home?: number;
    away?: number;
  };
  shots_off_target?: {
    home?: number;
    away?: number;
  };
  corners?: {
    home?: number;
    away?: number;
  };
  possession?: {
    home?: number;
    away?: number;
  };
  home?: StatsSide;
  away?: StatsSide;
};

type Match = {
  id?: string | number;
  fixture_id?: string | number;
  minute?: number | string;
  elapsed?: number | string;
  status?: string;
  state?: string;
  live?: boolean;

  home?: Team;
  away?: Team;

  teams?: {
    home?: Team;
    away?: Team;
  };

  home_team?: Team;
  away_team?: Team;

  goals?: {
    home?: number | string;
    away?: number | string;
  };

  score?: {
    home?: number | string;
    away?: number | string;
  };

  statistics?: Statistics;

  stats?: Statistics;

  corners?: {
    home?: number | string;
    away?: number | string;
  };

  pressure?: {
    team?: string;
    side?: string;
    passed?: boolean;
    dangerous_attacks?: number;
    attacks?: number;
    shots?: number;
    shots_on_target?: number;
    corners?: number;
    window?: string;
  };

  alert?: boolean;
  alert_triggered?: boolean;
  criteria_passed?: boolean;
  window?: string;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;

  checked_at?: string;

  live_matches?: number | Match[];

  matches?: Match[];

  data?: Match[];

  result?: {
    live_matches?: number | Match[];
    matches?: Match[];
    data?: Match[];
    results?: Match[];
    checked_at?: string;
    skipped?: boolean;
    reason?: string;
    wait_seconds?: number;
  };

  results?: Match[];
};

type SideStats = {
  attacks: number;
  dangerousAttacks: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  possession: number;
};

type Pressure = {
  side: "home" | "away" | null;
  team: string;
  passed: boolean;
  window: string;
};

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function minuteOf(match: Match): number {
  return numberValue(match.minute ?? match.elapsed);
}

function getHome(match: Match): Team {
  return (
    match.home ??
    match.teams?.home ??
    match.home_team ??
    {}
  );
}

function getAway(match: Match): Team {
  return (
    match.away ??
    match.teams?.away ??
    match.away_team ??
    {}
  );
}

function homeName(match: Match): string {
  return getHome(match).name || "Home";
}

function awayName(match: Match): string {
  return getAway(match).name || "Away";
}

function homeId(match: Match): string {
  return String(getHome(match).id ?? "");
}

function awayId(match: Match): string {
  return String(getAway(match).id ?? "");
}

function matchId(match: Match): string {
  return String(match.id ?? match.fixture_id ?? "");
}

function homeScore(match: Match): number {
  return numberValue(
    match.goals?.home ??
      match.score?.home
  );
}

function awayScore(match: Match): number {
  return numberValue(
    match.goals?.away ??
      match.score?.away
  );
}

function getStats(match: Match): Statistics {
  return match.statistics ?? match.stats ?? {};
}

function getSideStats(
  match: Match,
  side: "home" | "away"
): SideStats {
  const stats = getStats(match);
  const direct = side === "home" ? stats.home : stats.away;

  const attacks =
    direct?.attacks ??
    stats.attacks?.[side] ??
    0;

  const dangerousAttacks =
    direct?.dangerous_attacks ??
    stats.dangerous_attacks?.[side] ??
    0;

  const shots =
    direct?.shots ??
    stats.shots?.[side] ??
    numberValue(direct?.shots_on_target) +
      numberValue(direct?.shots_off_target);

  const shotsOnTarget =
    direct?.shots_on_target ??
    stats.shots_on_target?.[side] ??
    0;

  const corners =
    direct?.corners ??
    numberValue(match.corners?.[side]) ??
    stats.corners?.[side] ??
    0;

  const possession =
    direct?.possession ??
    stats.possession?.[side] ??
    0;

  return {
    attacks: numberValue(attacks),
    dangerousAttacks: numberValue(dangerousAttacks),
    shots: numberValue(shots),
    shotsOnTarget: numberValue(shotsOnTarget),
    corners: numberValue(corners),
    possession: numberValue(possession),
  };
}

function isLive(match: Match): boolean {
  if (match.live === true) {
    return true;
  }

  const status = String(
    match.status ?? match.state ?? ""
  ).toLowerCase();

  const liveStatuses = [
    "live",
    "in_play",
    "inplay",
    "1h",
    "2h",
    "ht",
    "extra_time",
    "et",
    "penalties",
    "first_half",
    "second_half",
  ];

  if (liveStatuses.includes(status)) {
    return true;
  }

  const minute = minuteOf(match);

  return (
    minute > 0 &&
    minute <= 130 &&
    ![
      "finished",
      "ft",
      "ended",
      "cancelled",
      "postponed",
      "scheduled",
      "not_started",
    ].includes(status)
  );
}

function pressureFor(
  match: Match,
  side: "home" | "away"
): boolean {
  const minute = minuteOf(match);
  const stats = getSideStats(match, side);

  if (minute >= 25 && minute <= 45) {
    return (
      stats.dangerousAttacks >= 20 &&
      stats.shots >= 8 &&
      stats.shotsOnTarget >= 4 &&
      stats.corners >= 4
    );
  }

  if (minute >= 65 && minute <= 130) {
    return (
      stats.dangerousAttacks >= 60 &&
      stats.shots >= 12 &&
      stats.shotsOnTarget >= 5 &&
      stats.corners >= 6
    );
  }

  return false;
}

function pressureWindow(minute: number): string {
  if (minute >= 25 && minute <= 45) {
    return "25′–45′";
  }

  if (minute >= 65 && minute <= 130) {
    return "65′–90′+";
  }

  return "OUTSIDE ALERT WINDOW";
}

function getPressure(match: Match): Pressure {
  const minute = minuteOf(match);

  if (
    minute < 25 ||
    (minute > 45 && minute < 65)
  ) {
    return {
      side: null,
      team: "",
      passed: false,
      window: pressureWindow(minute),
    };
  }

  const homePassed = pressureFor(match, "home");
  const awayPassed = pressureFor(match, "away");

  if (homePassed) {
    return {
      side: "home",
      team: homeName(match),
      passed: true,
      window: pressureWindow(minute),
    };
  }

  if (awayPassed) {
    return {
      side: "away",
      team: awayName(match),
      passed: true,
      window: pressureWindow(minute),
    };
  }

  return {
    side: null,
    team: "",
    passed: false,
    window: pressureWindow(minute),
  };
}

function normalizeMatches(payload: ApiResponse): Match[] {
  const candidates: unknown[] = [];

  if (Array.isArray(payload.matches)) {
    candidates.push(...payload.matches);
  }

  if (Array.isArray(payload.data)) {
    candidates.push(...payload.data);
  }

  if (Array.isArray(payload.results)) {
    candidates.push(...payload.results);
  }

  if (payload.result) {
    if (Array.isArray(payload.result.matches)) {
      candidates.push(...payload.result.matches);
    }

    if (Array.isArray(payload.result.data)) {
      candidates.push(...payload.result.data);
    }

    if (Array.isArray(payload.result.results)) {
      candidates.push(...payload.result.results);
    }

    if (Array.isArray(payload.result.live_matches)) {
      candidates.push(...payload.result.live_matches);
    }
  }

  if (Array.isArray(payload.live_matches)) {
    candidates.push(...payload.live_matches);
  }

  const unique = new Map<string, Match>();

  for (const item of candidates) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const match = item as Match;

    if (!isLive(match)) {
      continue;
    }

    const id = matchId(match);

    if (!id) {
      continue;
    }

    unique.set(id, match);
  }

  return Array.from(unique.values());
}

async function fetchWorker(): Promise<ApiResponse> {
  const response = await fetch(`${WORKER_URL}/run`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
  });

  const text = await response.text();

  let json: ApiResponse;

  try {
    json = JSON.parse(text) as ApiResponse;
  } catch {
    throw new Error(
      `Ο Worker επέστρεψε μη έγκυρη απάντηση (${response.status}).`
    );
  }

  if (!response.ok || json.ok === false) {
    throw new Error(
      json.error ||
        json.message ||
        `Σφάλμα Worker (${response.status}).`
    );
  }

  return json;
}

function StatsRow({
  label,
  home,
  away,
}: {
  label: string;
  home: number;
  away: number;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statValue}>{home}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{away}</Text>
    </View>
  );
}

function MatchCard({ match }: { match: Match }) {
  const minute = minuteOf(match);
  const home = getSideStats(match, "home");
  const away = getSideStats(match, "away");
  const pressure = getPressure(match);

  return (
    <View style={styles.card}>
      <View style={styles.liveHeader}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>

        <Text style={styles.minute}>
          {minute > 0 ? `${minute}′` : "LIVE"}
        </Text>
      </View>

      <View style={styles.teamsRow}>
        <View style={styles.teamBlock}>
          <Text style={styles.teamName} numberOfLines={2}>
            {homeName(match)}
          </Text>
        </View>

        <View style={styles.scoreBlock}>
          <Text style={styles.score}>
            {homeScore(match)} - {awayScore(match)}
          </Text>
        </View>

        <View style={styles.teamBlock}>
          <Text
            style={[styles.teamName, styles.awayTeam]}
            numberOfLines={2}
          >
            {awayName(match)}
          </Text>
        </View>
      </View>

      {pressure.passed && (
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>
            🚨 PRESSURE ALERT
          </Text>

          <Text style={styles.alertTeam}>
            {pressure.team}
          </Text>

          <Text style={styles.alertPassed}>
            ALL CRITERIA PASSED
          </Text>

          <Text style={styles.alertWindow}>
            Window: {pressure.window}
          </Text>
        </View>
      )}

      <View style={styles.statsBox}>
        <Text style={styles.statsTitle}>
          MATCH STATISTICS
        </Text>

        <StatsRow
          label="Attacks"
          home={home.attacks}
          away={away.attacks}
        />

        <StatsRow
          label="Dangerous Attacks"
          home={home.dangerousAttacks}
          away={away.dangerousAttacks}
        />

        <StatsRow
          label="Shots"
          home={home.shots}
          away={away.shots}
        />

        <StatsRow
          label="Shots on Target"
          home={home.shotsOnTarget}
          away={away.shotsOnTarget}
        />

        <StatsRow
          label="Corners"
          home={home.corners}
          away={away.corners}
        />

        <StatsRow
          label="Possession %"
          home={home.possession}
          away={away.possession}
        />
      </View>

      <View style={styles.criteriaBox}>
        <Text style={styles.criteriaTitle}>
          ALERT WINDOWS
        </Text>

        <View style={styles.criteriaRow}>
          <Text style={styles.criteriaTime}>
            25′–45′
          </Text>

          <Text style={styles.criteriaText}>
            DA ≥20 • Shots ≥8 • SOT ≥4 • Corners ≥4
          </Text>
        </View>

        <View style={styles.criteriaRow}>
          <Text style={styles.criteriaTime}>
            65′–90′+
          </Text>

          <Text style={styles.criteriaText}>
            DA ≥60 • Shots ≥12 • SOT ≥5 • Corners ≥6
          </Text>
        </View>
      </View>

      <Text style={styles.fixtureId}>
        LIVE ID: {matchId(match)}
      </Text>
    </View>
  );
}

export default function Index() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");

  const loadMatches = useCallback(
    async (manual = false) => {
      if (manual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        setError("");

        const payload = await fetchWorker();
        const liveMatches = normalizeMatches(payload);

        setMatches(liveMatches);

        const checkedAt =
          payload.checked_at ??
          payload.result?.checked_at;

        if (checkedAt) {
          const date = new Date(checkedAt);

          if (!Number.isNaN(date.getTime())) {
            setLastUpdate(
              date.toLocaleTimeString("el-GR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            );
          }
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Άγνωστο σφάλμα.";

        setError(
          `Δεν ήταν δυνατή η φόρτωση των LIVE αγώνων.\n${message}`
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadMatches(false);

    const timer = setInterval(() => {
      loadMatches(false);
    }, REFRESH_MS);

    return () => {
      clearInterval(timer);
    };
  }, [loadMatches]);

  const alertCount = useMemo(() => {
    return matches.reduce((count, match) => {
      return count + (getPressure(match).passed ? 1 : 0);
    }, 0);
  }, [matches]);

  const renderMatch = useCallback(
    ({ item }: { item: Match }) => (
      <MatchCard match={item} />
    ),
    []
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#050505"
      />

      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            ⚽ Football Live Alerts
          </Text>

          <Text style={styles.subtitle}>
            LIVE matches • Pressure alerts
          </Text>

          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text style={styles.headerNumber}>
                {matches.length}
              </Text>

              <Text style={styles.headerLabel}>
                LIVE
              </Text>
            </View>

            <View style={styles.headerStat}>
              <Text style={styles.headerNumber}>
                {alertCount}
              </Text>

              <Text style={styles.headerLabel}>
                ALERTS
              </Text>
            </View>
          </View>
        </View>

        {loading && matches.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />

            <Text style={styles.loadingText}>
              Φόρτωση LIVE αγώνων...
            </Text>
          </View>
        ) : error && matches.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.centerScroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadMatches(true)}
              />
            }
          >
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>

              <Text style={styles.errorTitle}>
                Σφάλμα σύνδεσης
              </Text>

              <Text style={styles.errorText}>
                {error}
              </Text>

              <Text style={styles.retryText}>
                Κάνε pull down για νέα προσπάθεια.
              </Text>
            </View>
          </ScrollView>
        ) : matches.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.centerScroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadMatches(true)}
              />
            }
          >
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>
                🔴
              </Text>

              <Text style={styles.emptyTitle}>
                NO LIVE MATCHES
              </Text>

              <Text style={styles.emptyText}>
                Δεν υπάρχουν αυτή τη στιγμή
                ζωντανοί αγώνες.
              </Text>

              <Text style={styles.emptySubtext}>
                Η εφαρμογή εμφανίζει αποκλειστικά
                LIVE αγώνες.
              </Text>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={matches}
            keyExtractor={(item, index) =>
              `${matchId(item)}-${index}`
            }
            renderItem={renderMatch}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadMatches(true)}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Auto refresh: 30s
          </Text>

          {lastUpdate ? (
            <Text style={styles.footerText}>
              Updated: {lastUpdate}
            </Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#050505",
  },

  container: {
    flex: 1,
    backgroundColor: "#050505",
  },

  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#202020",
  },

  title: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "800",
  },

  subtitle: {
    color: "#999999",
    fontSize: 14,
    marginTop: 5,
  },

  headerStats: {
    flexDirection: "row",
    marginTop: 15,
    gap: 10,
  },

  headerStat: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#242424",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: "center",
    minWidth: 85,
  },

  headerNumber: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
  },

  headerLabel: {
    color: "#888888",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "700",
  },

  list: {
    padding: 14,
    paddingBottom: 30,
  },

  card: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#252525",
    borderRadius: 18,
    padding: 15,
    marginBottom: 14,
  },

  liveHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#210b0b",
    borderWidth: 1,
    borderColor: "#8c2020",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#ff3030",
    marginRight: 6,
  },

  liveText: {
    color: "#ff5555",
    fontSize: 12,
    fontWeight: "900",
  },

  minute: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },

  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  teamBlock: {
    flex: 1,
  },

  teamName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },

  awayTeam: {
    textAlign: "right",
  },

  scoreBlock: {
    paddingHorizontal: 12,
    alignItems: "center",
  },

  score: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
  },

  alertBox: {
    backgroundColor: "#241000",
    borderWidth: 1,
    borderColor: "#ff7a00",
    borderRadius: 13,
    padding: 12,
    marginBottom: 13,
  },

  alertTitle: {
    color: "#ff9d3d",
    fontSize: 14,
    fontWeight: "900",
  },

  alertTeam: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },

  alertPassed: {
    color: "#64ff8a",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },

  alertWindow: {
    color: "#bbbbbb",
    fontSize: 11,
    marginTop: 3,
  },

  statsBox: {
    backgroundColor: "#111111",
    borderRadius: 13,
    padding: 11,
  },

  statsTitle: {
    color: "#777777",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },

  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: "#1e1e1e",
  },

  statValue: {
    width: 50,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  statLabel: {
    flex: 1,
    color: "#999999",
    fontSize: 12,
    textAlign: "center",
  },

  criteriaBox: {
    marginTop: 12,
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    padding: 11,
  },

  criteriaTitle: {
    color: "#777777",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 7,
  },

  criteriaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 5,
  },

  criteriaTime: {
    width: 75,
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },

  criteriaText: {
    flex: 1,
    color: "#777777",
    fontSize: 10,
    lineHeight: 15,
  },

  fixtureId: {
    color: "#444444",
    fontSize: 9,
    marginTop: 9,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  centerScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  loadingText: {
    color: "#999999",
    marginTop: 12,
    fontSize: 14,
  },

  emptyBox: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#252525",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
  },

  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },

  emptyText: {
    color: "#aaaaaa",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 21,
  },

  emptySubtext: {
    color: "#666666",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },

  errorBox: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#160909",
    borderWidth: 1,
    borderColor: "#7d2525",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
  },

  errorIcon: {
    fontSize: 35,
    marginBottom: 10,
  },

  errorTitle: {
    color: "#ff6666",
    fontSize: 20,
    fontWeight: "900",
  },

  errorText: {
    color: "#dddddd",
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 19,
  },

  retryText: {
    color: "#777777",
    fontSize: 11,
    marginTop: 14,
    textAlign: "center",
  },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#1b1b1b",
    backgroundColor: "#080808",
  },

  footerText: {
    color: "#555555",
    fontSize: 10,
  },
});