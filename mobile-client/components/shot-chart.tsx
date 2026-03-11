import { FilterOptionButtons } from '@/components/filter-option-buttons';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { memo, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  Path,
  Rect,
  Svg,
} from 'react-native-svg';

/** Creates SVG path for a pie slice. Angles in degrees, 0° = 3 o'clock, start from top (-90°). */
function pieSlicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export type ShotAttempt = {
  x: number; // coordinate_x_raw: 0–50 (court width, left to right)
  y: number; // coordinate_y_raw: distance from basket in feet (y=0 at rim)
  made: boolean;
  pts: number; // 2 or 3
};

type ShotFilter = 'all' | 'made' | 'missed' | '2pt' | '3pt';
type BreakdownFilter = 'accuracy' | 'points' | 'attempts';

/** Points from 2PT, 3PT, FT from player aggregates (boxscores). Use for pie chart to match stat highlight. */
export type PointsBreakdown = { pts2pt: number; pts3pt: number; ptsFt: number };

/** FG/3PT/FT made and attempted from player aggregates. When provided, accuracy bars use this for consistency with stat highlight. */
export type AccuracyFromPlayer = {
  fgMade: number;
  fgAttempts: number;
  threePtMade: number;
  threePtAttempts: number;
  ftMade: number;
  ftAttempts: number;
};

type ShotChartProps = {
  shots: ShotAttempt[];
  isLoading?: boolean;
  colorScheme: 'light' | 'dark';
  /** Free throw stats from player data (shots API excludes FTs) */
  ftMade?: number;
  ftAttempts?: number;
  /** Points breakdown from player aggregates. When provided, pie chart uses this for consistency with stat highlight. */
  ptsBreakdown?: PointsBreakdown;
  /** Accuracy (FG/3PT/FT made-attempted) from player aggregates. When provided, accuracy bars use this for consistency with stat highlight. */
  accuracyFromPlayer?: AccuracyFromPlayer;
};

// Real NBA half-court dimensions in feet
const COURT_WIDTH_FT = 50;
const COURT_DEPTH_FT = 47; // baseline to half-court line
const BASKET_X_FT = 25; // center of court width
const BASKET_Y_FT = 4.75; // feet from baseline
// 3-point line: arc radius 23.75ft, corners at 3ft from sideline
const THREE_PT_RADIUS_FT = 23.75;
const THREE_PT_CORNER_X_FT = 3; // feet from each sideline
// Exact y where the 23.75ft arc circle intersects x=3ft, so the corner point lies
// precisely on the circle and SVG doesn't silently scale the radius.
const THREE_PT_CORNER_Y_FT =
  BASKET_Y_FT +
  Math.sqrt(
    THREE_PT_RADIUS_FT ** 2 - (BASKET_X_FT - THREE_PT_CORNER_X_FT) ** 2,
  ); // ≈ 13.698ft
// Key (paint): 16ft wide, 19ft deep from baseline
const KEY_WIDTH_FT = 16;
const KEY_DEPTH_FT = 19;
// Free throw circle radius
const FT_CIRCLE_RADIUS_FT = 6;
// Rotation of the solid/dashed split on the FT circle, in degrees.
// 0 = horizontal (standard — dashed half faces basket, solid half faces half-court).
// Positive values rotate the split clockwise; try e.g. 45 or 90.
const FT_CIRCLE_SPLIT_ANGLE_DEG = 0;
// Restricted area
const RESTRICTED_RADIUS_FT = 4;

export const ShotChart = memo(function ShotChart({
  shots,
  isLoading = false,
  colorScheme,
  ftMade: ftMadeProp,
  ftAttempts: ftAttemptsProp,
  ptsBreakdown: ptsBreakdownProp,
  accuracyFromPlayer: accuracyFromPlayerProp,
}: ShotChartProps) {
  const [filter, setFilter] = useState<ShotFilter>('all');
  const [breakdownFilter, setBreakdownFilter] = useState<BreakdownFilter>('accuracy');
  const colors = Colors[colorScheme];

  const courtColor = colorScheme === 'dark' ? '#000000' : '#f0efe9';
  const paintColor = colorScheme === 'dark' ? '#000000' : '#e8e2d4';
  const lineColor = colorScheme === 'dark' ? '#ffffff' : '#b0a898';
  const basketColor = colorScheme === 'dark' ? '#e87c2a' : '#e87c2a';

  // Filtered shots
  const filteredShots = useMemo(() => {
    switch (filter) {
      case 'made': return shots.filter(s => s.made);
      case 'missed': return shots.filter(s => !s.made);
      case '2pt': return shots.filter(s => s.pts === 2);
      case '3pt': return shots.filter(s => s.pts === 3);
      default: return shots;
    }
  }, [shots, filter]);

  // Stats for summary row — FG/3PT from shots; FT from optional props (shots API excludes FTs)
  const stats = useMemo(() => {
    const fgAttempts = shots.length;
    const fgMade = shots.filter(s => s.made).length;
    const threePtAttempts = shots.filter(s => s.pts === 3).length;
    const threePtMade = shots.filter(s => s.made && s.pts === 3).length;
    const twoPtAttempts = fgAttempts - threePtAttempts;
    const twoPtMade = fgMade - threePtMade;
    const fgPct = fgAttempts > 0 ? ((fgMade / fgAttempts) * 100).toFixed(1) : '—';
    const threePct = threePtAttempts > 0 ? ((threePtMade / threePtAttempts) * 100).toFixed(1) : '—';
    const ftMade = ftMadeProp ?? 0;
    const ftAttempts = ftAttemptsProp ?? 0;
    const ftPct = ftAttempts > 0 ? ((ftMade / ftAttempts) * 100).toFixed(1) : '—';
    // True Shooting %: PTS / (2 * (FGA + 0.44 * FTA))
    const ptsFromFg = shots.filter(s => s.made).reduce((sum, s) => sum + s.pts, 0);
    const totalPts = ptsFromFg + ftMade;
    const tspDenom = 2 * (fgAttempts + 0.44 * ftAttempts);
    const tspPct = tspDenom > 0 ? ((totalPts / tspDenom) * 100).toFixed(1) : '—';
    // Points breakdown: 2PT pts, 3PT pts, FT pts
    const pts2pt = twoPtMade * 2;
    const pts3pt = threePtMade * 3;
    const ptsFt = ftMade;
    const totalAttempts = fgAttempts + ftAttempts;
    const pctPts2pt = totalPts > 0 ? ((pts2pt / totalPts) * 100).toFixed(1) : '0';
    const pctPts3pt = totalPts > 0 ? ((pts3pt / totalPts) * 100).toFixed(1) : '0';
    const pctPtsFt = totalPts > 0 ? ((ptsFt / totalPts) * 100).toFixed(1) : '0';
    const pctAtt2pt = totalAttempts > 0 ? ((twoPtAttempts / totalAttempts) * 100).toFixed(1) : '0';
    const pctAtt3pt = totalAttempts > 0 ? ((threePtAttempts / totalAttempts) * 100).toFixed(1) : '0';
    const pctAttFt = totalAttempts > 0 ? ((ftAttempts / totalAttempts) * 100).toFixed(1) : '0';
    return {
      fgMade, fgAttempts, fgPct, threePtMade, threePtAttempts, threePct, ftMade, ftAttempts, ftPct, tspPct,
      twoPtAttempts, twoPtMade, pts2pt, pts3pt, ptsFt, totalPts, totalAttempts,
      pctPts2pt, pctPts3pt, pctPtsFt, pctAtt2pt, pctAtt3pt, pctAttFt,
    };
  }, [shots, ftMadeProp, ftAttemptsProp]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.cardBackground }]}>
        <ActivityIndicator size="small" color={colors.tint} />
        <ThemedText style={styles.loadingText}>Loading shot chart…</ThemedText>
      </View>
    );
  }

  if (!isLoading && shots.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.cardBackground }]}>
        <ThemedText style={styles.loadingText}>No shot data available</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats summary — percentage on top, raw count on bottom */}
      {/* <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>FG</ThemedText>
          <ThemedText style={styles.statValue}>{stats.fgPct}%</ThemedText>
          <ThemedText style={styles.statLabel}>({stats.fgMade}/{stats.fgAttempts})</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>3PT</ThemedText>
          <ThemedText style={styles.statValue}>{stats.threePct}%</ThemedText>
          <ThemedText style={styles.statLabel}>({stats.threePtMade}/{stats.threePtAttempts})</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>FT</ThemedText>
          <ThemedText style={styles.statValue}>{stats.ftPct}%</ThemedText>
          <ThemedText style={styles.statLabel}>({stats.ftMade}/{stats.ftAttempts})</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>TSP</ThemedText>
          <ThemedText style={styles.statValue}>{stats.tspPct}%</ThemedText>
        </View>
      </View> */}

      {/* Points & attempts breakdown — horizontal progress bars */}
      <View style={styles.breakdownContainer}>
        <View style={styles.breakdownFilterRow}>
          <FilterOptionButtons
            options={[
              { key: 'accuracy', label: 'Accuracy' },
              { key: 'points', label: 'Points breakdown' },
              { key: 'attempts', label: 'Attempts breakdown' },
            ]}
            value={breakdownFilter}
            onSelect={(key) => setBreakdownFilter(key as BreakdownFilter)}
            colorScheme={colorScheme}
            scrollable
          />
        </View>
        <View style={styles.breakdownContent}>
        {breakdownFilter === 'points' || breakdownFilter === 'attempts' ? (
          /* Total Points / Total Attempts: pie chart (stacked bar chart commented out below) */
          (() => {
            const isPoints = breakdownFilter === 'points';
            let total: number;
            let ftPct: number;
            let twoPtPct: number;
            let threePtPct: number;
            if (isPoints && ptsBreakdownProp) {
              const { pts2pt, pts3pt, ptsFt } = ptsBreakdownProp;
              total = pts2pt + pts3pt + ptsFt;
              ftPct = total > 0 ? ptsFt / total : 0;
              twoPtPct = total > 0 ? pts2pt / total : 0;
              threePtPct = total > 0 ? pts3pt / total : 0;
            } else {
              total = isPoints ? stats.totalPts : stats.totalAttempts;
              ftPct = total > 0
                ? (isPoints ? stats.ptsFt : stats.ftAttempts) / total
                : 0;
              twoPtPct = total > 0
                ? (isPoints ? stats.pts2pt : stats.twoPtAttempts) / total
                : 0;
              threePtPct = total > 0
                ? (isPoints ? stats.pts3pt : stats.threePtAttempts) / total
                : 0;
            }
            const SHOT_TYPE_COLORS = { FT: '#595457', '2PT': '#B7B5B3', '3PT': '#ffffff' };
            const segments = [
              { key: 'Free Throws', pct: ftPct, color: SHOT_TYPE_COLORS.FT },
              { key: '2PT', pct: twoPtPct, color: SHOT_TYPE_COLORS['2PT'] },
              { key: '3PT', pct: threePtPct, color: SHOT_TYPE_COLORS['3PT'] },
            ];
            const PIE_SIZE = 120;
            const cx = PIE_SIZE / 2;
            const cy = PIE_SIZE / 2;
            const r = (PIE_SIZE / 2) - 4;
            let cumulativeDeg = -90;
            const hasData = total > 0;
            return (
              <View style={styles.pieChartContainer}>
                <Svg width={PIE_SIZE} height={PIE_SIZE} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}>
                  {hasData ? (
                    segments.map(({ key, pct, color }) => {
                      const angle = Math.max(pct * 360, 0.1);
                      const startDeg = cumulativeDeg;
                      const endDeg = startDeg + angle;
                      cumulativeDeg = endDeg;
                      const d = pieSlicePath(cx, cy, r, startDeg, endDeg);
                      return <Path key={key} d={d} fill={color} />;
                    })
                  ) : (
                    <Circle cx={cx} cy={cy} r={r} fill="rgba(128,128,128,0.3)" />
                  )}
                </Svg>
                <View style={styles.pieChartLegend}>
                  {segments.map(({ key, pct, color }) => (
                    <View key={key} style={styles.pieChartLegendItem}>
                      <View style={[styles.pieChartLegendDot, { backgroundColor: color }]} />
                      <View style={styles.pieChartLegendItemLabel}>
                        <ThemedText style={styles.pieChartLegendText}>{key}</ThemedText>
                        <ThemedText style={styles.pieChartLegendValue}>
                          {total > 0 ? `${(pct * 100).toFixed(1)}%` : '—'}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
                {/* Stacked bar chart (previous visualization):
                <View style={styles.stackedPointsContainer}>
                  <View style={styles.stackedPointsBar}>...</View>
                  <View style={styles.stackedPointsLabels}>...</View>
                </View> */}
              </View>
            );
          })()
        ) : (
          /* Accuracy: individual progress bars — use player aggregates when provided for consistency with stat highlight */
          (() => {
            const acc = accuracyFromPlayerProp;
            const rows = acc
              ? [
                  { key: 'fg', label: 'Field Goals', made: acc.fgMade, attempts: acc.fgAttempts },
                  { key: '2pt', label: '2PT', made: Math.max(0, acc.fgMade - acc.threePtMade), attempts: Math.max(0, acc.fgAttempts - acc.threePtAttempts) },
                  { key: '3pt', label: '3PT', made: acc.threePtMade, attempts: acc.threePtAttempts },
                  { key: 'ft', label: 'Free Throws', made: acc.ftMade, attempts: acc.ftAttempts },
                ]
              : [
                  { key: 'fg', label: 'Field Goals', made: stats.fgMade, attempts: stats.fgAttempts },
                  { key: '2pt', label: '2PT', made: stats.twoPtMade, attempts: stats.twoPtAttempts },
                  { key: '3pt', label: '3PT', made: stats.threePtMade, attempts: stats.threePtAttempts },
                  { key: 'ft', label: 'Free Throws', made: stats.ftMade, attempts: stats.ftAttempts },
                ];
            return rows.map(({ key, label, made, attempts }) => {
            const isIndented = key === '2pt' || key === '3pt';
            let fillPct = 0;
            let valueStr = '—';
            fillPct = attempts > 0 ? made / attempts : 0;
            valueStr = attempts > 0 ? `${(fillPct * 100).toFixed(1)}%` : '—';
              return (
                <View key={key} style={[styles.breakdownBarRow, isIndented && styles.breakdownBarRowIndented]}>
                  <ThemedText style={[styles.breakdownBarLabel, isIndented && styles.breakdownBarLabelIndented]}>{label}</ThemedText>
                  <View style={[styles.breakdownBarTrack, isIndented && styles.breakdownBarTrackIndented]}>
                    <View
                      style={[
                        styles.breakdownBarFill,
                        { width: `${fillPct * 100}%` },
                      ]}
                    />
                  </View>
                  <ThemedText style={[styles.breakdownBarPct, isIndented && styles.breakdownBarIndentedText]}>{valueStr}</ThemedText>
                </View>
              );
            });
          })()
        )}
        </View>
        {/* Stacked bar: % of shots by type (FT, 2PT, 3PT) */}
        {/* {(() => {
          const total = stats.totalAttempts;
          const ftPct = total > 0 ? stats.ftAttempts / total : 0;
          const twoPtPct = total > 0 ? stats.twoPtAttempts / total : 0;
          const threePtPct = total > 0 ? stats.threePtAttempts / total : 0;
          const SHOT_TYPE_COLORS = { FT: '#2196F3', '2PT': '#FF9800', '3PT': '#4CAF50' };
          return (
            <>
              <View style={styles.breakdownBarRow}>
                <ThemedText style={styles.breakdownBarLabel}>Mix</ThemedText>
                <View style={styles.breakdownBarTrack}>
                  <View style={[styles.stackedSegment, { width: `${ftPct * 100}%`, backgroundColor: SHOT_TYPE_COLORS.FT }]} />
                  <View style={[styles.stackedSegment, { width: `${twoPtPct * 100}%`, backgroundColor: SHOT_TYPE_COLORS['2PT'] }]} />
                  <View style={[styles.stackedSegment, { width: `${threePtPct * 100}%`, backgroundColor: SHOT_TYPE_COLORS['3PT'] }]} />
                </View>
                <View style={styles.breakdownBarRight} />
              </View>
              <View style={styles.stackedLegend}>
                <View style={[styles.stackedLegendDot, { backgroundColor: SHOT_TYPE_COLORS.FT }]} />
                <ThemedText style={styles.stackedLegendLabel}>FT</ThemedText>
                <View style={[styles.stackedLegendDot, { backgroundColor: SHOT_TYPE_COLORS['2PT'] }]} />
                <ThemedText style={styles.stackedLegendLabel}>2PT</ThemedText>
                <View style={[styles.stackedLegendDot, { backgroundColor: SHOT_TYPE_COLORS['3PT'] }]} />
                <ThemedText style={styles.stackedLegendLabel}>3PT</ThemedText>
              </View>
            </>
          );
        })()} */}
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FilterOptionButtons
          options={[
            { key: 'all', label: 'All' },
            { key: 'made', label: 'Made' },
            { key: 'missed', label: 'Missed' },
            { key: '2pt', label: '2PT' },
            { key: '3pt', label: '3PT' },
          ]}
          value={filter}
          onSelect={(key) => setFilter(key as ShotFilter)}
          colorScheme={colorScheme}
        />
      </View>

      {/* Court SVG */}
      <CourtSvg
        shots={filteredShots}
        courtColor={courtColor}
        paintColor={paintColor}
        lineColor={lineColor}
        basketColor={basketColor}
      />

      {/* Legend — centered below the chart */}
      <View style={styles.legendContainer}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, styles.legendDotMade]} />
          <ThemedText style={styles.legendLabel}>Made</ThemedText>
          <View style={[styles.legendDot, styles.legendDotMiss]} />
          <ThemedText style={styles.legendLabel}>Missed</ThemedText>
        </View>
      </View>
    </View>
  );
});

// ─── Court SVG ───────────────────────────────────────────────────────────────

type CourtSvgProps = {
  shots: ShotAttempt[];
  courtColor: string;
  paintColor: string;
  lineColor: string;
  basketColor: string;
};

const CHART_WIDTH = 320;
// Maintain aspect ratio: show full half-court depth (47ft) plus a small margin
const CHART_HEIGHT = Math.round((COURT_DEPTH_FT / COURT_WIDTH_FT) * CHART_WIDTH);

// Convert real-world feet to SVG pixels.
// Basket is at the TOP of the SVG; half-court line is at the BOTTOM.
function ftToSvg(xFt: number, yFt: number): { svgX: number; svgY: number } {
  const scale = CHART_WIDTH / COURT_WIDTH_FT;
  const svgX = xFt * scale;
  // yFt=0 is baseline (top), yFt=47 is half-court (bottom)
  const svgY = yFt * scale;
  return { svgX, svgY };
}

const { svgX: basketSvgX, svgY: basketSvgY } = ftToSvg(BASKET_X_FT, BASKET_Y_FT);

// Build the 3-point arc path.
// The arc runs from the left corner (x=3ft, y=14ft from baseline)
// around the basket at 23.75ft radius to the right corner (x=47ft, y=14ft).
function build3ptPath(): string {
  const scale = CHART_WIDTH / COURT_WIDTH_FT;

  // Corner line endpoints (in SVG coords)
  const leftCornerTop = ftToSvg(THREE_PT_CORNER_X_FT, THREE_PT_CORNER_Y_FT);
  const leftCornerBottom = ftToSvg(THREE_PT_CORNER_X_FT, 0);
  const rightCornerTop = ftToSvg(COURT_WIDTH_FT - THREE_PT_CORNER_X_FT, THREE_PT_CORNER_Y_FT);
  const rightCornerBottom = ftToSvg(COURT_WIDTH_FT - THREE_PT_CORNER_X_FT, 0);

  // Arc endpoints at the corner boundary
  const arcRadius = THREE_PT_RADIUS_FT * scale;
  // large-arc=0, sweep=0: selects the circle centered near the basket (above the chord),
  // minor arc (134°) that bows away from the basket toward half-court. Works correctly
  // in both y-up and y-down orientations. Corner points now lie exactly on the arc circle
  // (using the computed THREE_PT_CORNER_Y_FT), so SVG doesn't scale the radius.
  return [
    `M ${leftCornerBottom.svgX} ${leftCornerBottom.svgY}`,
    `L ${leftCornerTop.svgX} ${leftCornerTop.svgY}`,
    `A ${arcRadius} ${arcRadius} 0 0 0 ${rightCornerTop.svgX} ${rightCornerTop.svgY}`,
    `L ${rightCornerBottom.svgX} ${rightCornerBottom.svgY}`,
  ].join(' ');
}

// Build the free-throw circle path.
// The circle is centered at the free throw line (KEY_DEPTH_FT from baseline).
// FT_CIRCLE_SPLIT_ANGLE_DEG rotates the solid/dashed split clockwise from horizontal.
function buildFtCirclePath(topHalf: boolean): string {
  const scale = CHART_WIDTH / COURT_WIDTH_FT;
  // Center at the free throw line — KEY_DEPTH_FT measured from baseline
  const { svgX: cx, svgY: cy } = ftToSvg(BASKET_X_FT, KEY_DEPTH_FT);
  const r = FT_CIRCLE_RADIUS_FT * scale;

  // Compute the two split endpoints at the chosen rotation angle.
  // SVG has y-down, so the standard-math y component is negated.
  const theta = (FT_CIRCLE_SPLIT_ANGLE_DEG * Math.PI) / 180;
  const x1 = cx + r * Math.cos(Math.PI + theta);
  const y1 = cy - r * Math.sin(Math.PI + theta);
  const x2 = cx + r * Math.cos(theta);
  const y2 = cy - r * Math.sin(theta);

  // sweep=0: semicircle toward half-court (solid), sweep=1: toward basket (dashed).
  // This relationship holds for any rotation angle.
  if (topHalf) {
    return `M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
}

function buildRestrictedPath(): string {
  const scale = CHART_WIDTH / COURT_WIDTH_FT;
  const { svgX: cx, svgY: cy } = ftToSvg(BASKET_X_FT, BASKET_Y_FT);
  const r = RESTRICTED_RADIUS_FT * scale;
  return `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`;
}

const CourtSvg = memo(function CourtSvg({
  shots,
  courtColor,
  paintColor,
  lineColor,
  basketColor,
}: CourtSvgProps) {
  const scale = CHART_WIDTH / COURT_WIDTH_FT;

  // Key (paint) rect dimensions in SVG
  const keyLeft = ftToSvg(BASKET_X_FT - KEY_WIDTH_FT / 2, 0);
  const keyRight = ftToSvg(BASKET_X_FT + KEY_WIDTH_FT / 2, KEY_DEPTH_FT);
  const keyX = keyLeft.svgX;
  // Use min so the Rect's y is always the top-left corner regardless of y-orientation
  const keyY = Math.min(keyLeft.svgY, keyRight.svgY);
  const keyW = KEY_WIDTH_FT * scale;
  const keyH = KEY_DEPTH_FT * scale;

  // Backboard
  const backboardY = ftToSvg(BASKET_X_FT, BASKET_Y_FT - 1.5).svgY;

  return (
    <View style={styles.courtWrapper}>
    <Svg
      width={CHART_WIDTH}
      height={CHART_HEIGHT}
      style={styles.svg}
    >
      <Defs>
        <ClipPath id="courtClip">
          <Rect x={0} y={0} width={CHART_WIDTH} height={CHART_HEIGHT} />
        </ClipPath>
      </Defs>

      {/* Court background */}
      <Rect x={0} y={0} width={CHART_WIDTH} height={CHART_HEIGHT} fill={courtColor} />

      {/* Paint (key) */}
      <Rect
        x={keyX}
        y={keyY}
        width={keyW}
        height={keyH}
        fill={paintColor}
        stroke={lineColor}
        strokeWidth={1}
      />

      {/* Free throw circle — bottom half (dashed) */}
      <Path
        d={buildFtCirclePath(false)}
        fill="none"
        stroke={lineColor}
        strokeWidth={1}
        strokeDasharray={[4, 3]}
      />
      {/* Free throw circle — top half (solid) */}
      <Path
        d={buildFtCirclePath(true)}
        fill="none"
        stroke={lineColor}
        strokeWidth={1}
      />

      {/* 3-point arc + corner lines */}
      <Path
        d={build3ptPath()}
        fill="none"
        stroke={lineColor}
        strokeWidth={1}
      />

      {/* Restricted area arc */}
      <Path
        d={buildRestrictedPath()}
        fill="none"
        stroke={lineColor}
        strokeWidth={1}
      />

      {/* Backboard */}
      <Line
        x1={basketSvgX - scale * 3}
        y1={backboardY}
        x2={basketSvgX + scale * 3}
        y2={backboardY}
        stroke={lineColor}
        strokeWidth={4}
      />

      {/* Basket rim */}
      <Circle
        cx={basketSvgX}
        cy={basketSvgY}
        r={scale * 0.75}
        fill="none"
        stroke={basketColor}
        strokeWidth={2}
      />

      {/* Half-court line — dashed, drawn on top of the border rect's bottom edge */}
      <Line
        x1={0.75}
        y1={CHART_HEIGHT - 0.75}
        x2={CHART_WIDTH - 0.75}
        y2={CHART_HEIGHT - 0.75}
        stroke={lineColor}
        strokeWidth={1}
        strokeDasharray="4 3"
      />

      {/* Shot dots */}
      <G clipPath="url(#courtClip)">
        {shots.map((shot, i) => {
          // coordinate_y_raw: distance from basket (y=0 = rim). ftToSvg expects y from baseline.
          // Add BASKET_Y_FT so basket (0) → court 4.75, half-court (42.25) → court 47.
          const { svgX, svgY } = ftToSvg(shot.x, shot.y + BASKET_Y_FT);
          const isMade = shot.made;
          const is3pt = shot.pts === 3;

          if (isMade) {
            return (
              <Circle
                key={i}
                cx={svgX}
                cy={svgY}
                r={2}
                fill="transparent"
                stroke="rgba(76, 175, 80, 1)"
                strokeWidth={0.5}
                // fill={is3pt ? '#4caf50' : '#4caf50'}
                // fill="rgba(76, 175, 80, 0.25)"
                opacity={1}
              />
            );
          }
          return (
            <Circle
              key={i}
              cx={svgX}
              cy={svgY}
              r={2}
              fill="transparent"
              // fill="#430000"
              // fill="rgba(229, 57, 53, 0.25)"
              stroke="rgba(229, 57, 53, 1)"
              // stroke="rgb(150, 150, 150)"
              strokeWidth={0.5}
              opacity={1}
            />
          );
        })}
      </G>

      {/* Court border — drawn last so it renders on top of paint fill and other markings.
          Inset by strokeWidth/2 so the full stroke stays inside the SVG viewport. */}
      <Rect
        x={0.75}
        y={0.75}
        width={CHART_WIDTH - 1.5}
        height={CHART_HEIGHT - 1.5}
        fill="none"
        stroke={lineColor}
        strokeWidth={1}
      />
    </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  loadingContainer: {
    height: 180,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    opacity: 0.6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(128,128,128,0.25)',
  },
  breakdownContainer: {
    marginBottom: 16,
    paddingVertical: 12,
    // paddingHorizontal: 8,
    borderRadius: 8,
    // backgroundColor: 'rgba(128,128,128,0.08)',
    gap: 10,
    minHeight: 265,
  },
  breakdownFilterRow: {
    marginBottom: 16,
  },
  breakdownContent: {
    paddingHorizontal: 16,
    gap: 22,
  },
  breakdownBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownBarRowIndented: {},
  breakdownBarLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 90,
    textAlign: 'right',
  },
  breakdownBarIndentedText: {
    fontWeight: 'normal',
    opacity: 0.7,
  },
  breakdownBarLabelIndented: {
    fontWeight: 'normal',
    opacity: 0.7,
    paddingLeft: 16, // indent 2PT/3PT; right edge still aligns with Field Goals/Free Throws
  },
  breakdownBarTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    // backgroundColor: 'rgba(128,128,128,0.35)',
    backgroundColor: 'rgba(229, 57, 53, 0.35)',
    overflow: 'hidden',
  },
  breakdownBarTrackIndented: {
    // paddingLeft: 24, // space before green (keeps green position as desired)
    marginLeft: 12,   // shifts bar right; moves left edge of red section away from label
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#4caf50',
  },
  breakdownBarPct: {
    fontSize: 12,
    fontWeight: '600',
    width: 40,
    textAlign: 'left',
  },
  breakdownBarRight: {
    width: 40,
  },
  pieChartContainer: {
    alignItems: 'center',
    // marginTop: 8,
  },
  pieChartLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
    marginTop: 12,
    // flexWrap: 'wrap',
  },
  pieChartLegendItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  pieChartLegendItemLabel: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
  },
  pieChartLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6, // align with label text cap height
  },
  pieChartLegendText: {
    fontSize: 12,
    fontWeight: 'normal',
  },
  stackedPointsContainer: {
    marginTop: 8,
  },
  pieChartLegendValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  stackedPointsBar: {
    flexDirection: 'row',
    height: 24,
    borderRadius: 6,
    overflow: 'hidden',
  },
  stackedPointsSegment: {
    minWidth: 0,
  },
  stackedPointsLabels: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'center',
  },
  stackedPointsLabelSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  stackedPointsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  stackedPointsTypeLabel: {
    fontSize: 10,
    opacity: 0.8,
    marginTop: 2,
  },
  stackedSegment: {
    height: '100%',
    minWidth: 0,
  },
  stackedLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginLeft: 38,
  },
  stackedLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stackedLegendLabel: {
    fontSize: 10,
    opacity: 0.8,
    marginRight: 4,
  },
  legendContainer: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDotMade: {
    // backgroundColor: '#ff8c42',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#4caf50',
  },
  legendDotMiss: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#e53935',
  },
  legendLabel: {
    fontSize: 10,
    opacity: 0.7,
    marginRight: 4,
  },
  filtersContainer: {
    marginBottom: 12,
  },
  courtWrapper: {
    alignSelf: 'center',
    // Perspective skew: basket end (top) recedes, mid-court (bottom) comes forward
    transform: [{ perspective: 500 }, { rotateX: '18deg' }],
    // No borderRadius — it clips in local space before the 3D transform, which
    // cuts the narrow baseline corners off the trapezoid in screen space.
    overflow: 'hidden',
  },
  svg: {
    display: 'flex',
  },
});
