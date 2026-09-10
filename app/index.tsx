import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
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
};

type StatsSide = {
  home?: number;
  away?: number;
};

type Statistics = {
  attacks?: StatsSide;
  dangerous_attacks?: StatsSide;
  shots?: StatsSide;
  shots_on_target?: StatsSide;
  corners?: StatsSide;
};

type Match = {
  id?: string | number;
  fixture_id?: string | number;

  minute?: number | string;
  elapsed?: number | string;

  status?: string;

  teams?: {
    home?: Team;
    away?: Team;
  };

  score?: {
    home?: number;
    away?: number;
  };

  goals?: {
    home?: number;
    away?: number;
  };

  statistics?: Statistics;

  alert?: boolean;
  alert_team?: "home" | "away";
  alert_window?: string;
  all_criteria_passed?: boolean;
};

type ApiResponse = {
  ok?: boolean;
  live_matches?: Match[];
  matches?: Match[];
  data?: Match[];
};

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function minuteOf(match: Match): number {
  return numberValue(match.minute ?? match.elapsed);
}

function homeName(match: Match): string {
  return match.teams?.home?.name ?? "Home";
}

function awayName(match: Match): string {
  return match.teams?.away?.name ?? "Away";
}

function homeScore(match: Match): number {
  return numberValue(
    match.score?.home ?? match.goals?.home
  );
}

function awayScore(match: Match): number {
  return numberValue(
    match.score?.away ?? match.goals?.away
  );
}

function statsOf(match: Match) {
  const s = match.statistics ?? {};

  return {
    attacksHome: numberValue(s.attacks?.home),
    attacksAway: numberValue(s.attacks?.away),

    dangerousHome: numberValue(
      s.dangerous_attacks?.home
    ),
    dangerousAway: numberValue(
      s.dangerous_attacks?.away
    ),

    shotsHome: numberValue(s.shots?.home),
    shotsAway: numberValue(s.shots?.away),

    shotsTargetHome: numberValue(
      s.shots_on_target?.home
    ),
    shotsTargetAway: numberValue(
      s.shots_on_target?.away
    ),

    cornersHome: numberValue(
      s.corners?.home
    ),
    cornersAway: numberValue(
      s.corners?.away
    ),
  };
}

function teamPassed(
  dangerous: number,
  shots: number,
  shotsTarget: number,
  corners: number,
  minute: number
): boolean {
  if (minute >= 25 && minute <= 45) {
    return (
      dangerous >= 20 &&
      shots >= 8 &&
      shotsTarget >= 4 &&
      corners >= 4
    );
  }

  if (minute >= 65 && minute <= 120) {
    return (
      dangerous >= 60 &&
      shots >= 12 &&
      shotsTarget >= 5 &&
      corners >= 6
    );
  }

  return false;
}

function pressureInfo(match: Match) {
  const minute = minuteOf(match);
  const s = statsOf(match);

  const homePassed = teamPassed(
    s.dangerousHome,
    s.shotsHome,
    s.shotsTargetHome,
    s.cornersHome,
    minute
  );

  const awayPassed = teamPassed(
    s.dangerousAway,
    s.shotsAway,
    s.shotsTargetAway,
    s.cornersAway,
    minute
  );

  if (homePassed) {
    return {
      passed: true,
      team: homeName(match),
      window:
        minute >= 25 && minute <= 45
          ? "25′–45′"
          : "65′–90′+",
    };
  }

  if (awayPassed) {
    return {
      passed: true,
      team: awayName(match),
      window:
        minute >= 25 && minute <= 45
          ? "25′–45′"
          : "65′–90′+",
    };
  }

  return {
    passed: false,
    team: "",
    window: "",
  };
}

function normalizeMatches(
  response: ApiResponse
): Match[] {
  if (Array.isArray(response.live_matches)) {
    return response.live_matches;
  }

  if (Array.isArray(response.matches)) {
    return response.matches;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return [];
}

export default function HomeScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  const loadMatches = useCallback(async () => {
    try {
      setError("");

      const response = await fetch(
        `${WORKER_URL}/run`
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const json: ApiResponse =
        await response.json();

      const liveMatches =
        normalizeMatches(json);

      setMatches(liveMatches);
    } catch (error) {
      console.log(
        "Football Worker error:",
        error
      );

      setError(
        "Δεν ήταν δυνατή η φόρτωση των live αγώνων."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();

    const timer = setInterval(
      loadMatches,
      REFRESH_MS
    );

    return () => clearInterval(timer);
  }, [loadMatches]);

  const refresh = () => {
    setRefreshing(true);
    loadMatches();
  };

  const renderMatch = ({
    item,
  }: {
    item: Match;
  }) => {
    const minute = minuteOf(item);
    const pressure = pressureInfo(item);
    const s = statsOf(item);

    return (
      <View
        style={[
          styles.card,
          pressure.passed &&
            styles.alertCard,
        ]}
      >
        <View style={styles.topRow}>
          <Text style={styles.live}>
            ● LIVE
          </Text>

          <Text style={styles.minute}>
            {minute > 0
              ? `${minute}′`
              : "LIVE"}
          </Text>
        </View>

        <View style={styles.teams}>
          <View style={styles.team}>
            <Text style={styles.teamName}>
              {homeName(item)}
            </Text>

            <Text style={styles.score}>
              {homeScore(item)}
            </Text>
          </View>

          <Text style={styles.dash}>
            -
          </Text>

          <View style={styles.team}>
            <Text style={styles.teamName}>
              {awayName(item)}
            </Text>

            <Text style={styles.score}>
              {awayScore(item)}
            </Text>
          </View>
        </View>

        {pressure.passed && (
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>
              🔥 STRONG PRESSURE
            </Text>

            <Text style={styles.alertTeam}>
              {pressure.team}
            </Text>

            <Text style={styles.alertWindow}>
              {pressure.window}
            </Text>

            <Text style={styles.alertPassed}>
              ALL CRITERIA PASSED
            </Text>
          </View>
        )}

        <View style={styles.stats}>
          <Text style={styles.statTitle}>
            LIVE STATISTICS
          </Text>

          <Text style={styles.stat}>
            ⚡ Dangerous Attacks{" "}
            {s.dangerousHome} -{" "}
            {s.dangerousAway}
          </Text>

          <Text style={styles.stat}>
            📊 Attacks{" "}
            {s.attacksHome} -{" "}
            {s.attacksAway}
          </Text>

          <Text style={styles.stat}>
            🎯 Shots{" "}
            {s.shotsHome} -{" "}
            {s.shotsAway}
          </Text>

          <Text style={styles.stat}>
            🎯 Shots on Target{" "}
            {s.shotsTargetHome} -{" "}
            {s.shotsTargetAway}
          </Text>

          <Text style={styles.stat}>
            🚩 Corners{" "}
            {s.cornersHome} -{" "}
            {s.cornersAway}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
          />

          <Text style={styles.loading}>
            Φόρτωση live αγώνων...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          ⚽ Football Live Alerts
        </Text>

        <Text style={styles.subtitle}>
          Live matches • Pressure alerts
        </Text>
      </View>

      {error !== "" && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}

      {!error &&
        matches.length === 0 && (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>
              Δεν υπάρχουν live αγώνες
            </Text>

            <Text style={styles.emptyText}>
              Θα γίνει αυτόματη ανανέωση.
            </Text>
          </View>
        )}

      {matches.length > 0 && (
        <FlatList
          data={matches}
          keyExtractor={(item, index) =>
            String(
              item.id ??
                item.fixture_id ??
                index
            )
          }
          renderItem={renderMatch}
          contentContainerStyle={
            styles.list
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F14",
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
  },

  subtitle: {
    color: "#8D99A6",
    fontSize: 14,
    marginTop: 5,
  },

  list: {
    padding: 14,
    paddingBottom: 30,
  },

  card: {
    backgroundColor: "#151B23",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#27313D",
  },

  alertCard: {
    borderWidth: 2,
    borderColor: "#FF8A00",
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  live: {
    color: "#FF4D4D",
    fontSize: 13,
    fontWeight: "900",
  },

  minute: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  teams: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  team: {
    flex: 1,
    alignItems: "center",
  },

  teamName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  score: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 5,
  },

  dash: {
    color: "#697582",
    fontSize: 24,
    paddingHorizontal: 8,
  },

  stats: {
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#27313D",
  },

  statTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 9,
  },

  stat: {
    color: "#C2CBD5",
    fontSize: 13,
    marginBottom: 7,
  },

  alertBox: {
    marginTop: 14,
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#3A2108",
    borderWidth: 1,
    borderColor: "#FF8A00",
  },

  alertTitle: {
    color: "#FFB347",
    fontSize: 17,
    fontWeight: "900",
  },

  alertTeam: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },

  alertWindow: {
    color: "#FFB347",
    fontSize: 13,
    marginTop: 3,
  },

  alertPassed: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 5,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  loading: {
    color: "#AAB4BF",
    marginTop: 12,
    fontSize: 15,
  },

  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyText: {
    color: "#8995A3",
    marginTop: 8,
    textAlign: "center",
  },

  errorBox: {
    margin: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#35151A",
    borderWidth: 1,
    borderColor: "#8F303A",
  },

  errorText: {
    color: "#FFB8BF",
    textAlign: "center",
  },
});