// video time (s, new XTTS voice) -> story time (s, the timeline story.ts was written against). Generated from
// voice/line_starts.json + key word times in voice/words.json.
export const TIMEMAP: [number, number][] = [[0.0, 0.0], [7.577, 5.77], [15.92, 13.16], [16.999, 14.06], [24.553, 19.53], [30.84, 23.26], [37.979, 28.17], [45.642, 33.82], [53.402, 40.67], [58.419, 42.07], [63.9, 45.56], [65.304, 46.57], [66.54, 47.46], [68.76, 49.06], [69.34, 49.86], [71.399, 51.3], [73.36, 52.88], [75.88, 54.74], [77.86, 56.16], [80.395, 58.47], [86.651, 63.25], [90.23, 66.16], [91.45, 66.84], [92.974, 67.87], [100.124, 72.88], [106.571, 76.58], [112.89, 81.86], [115.07, 84.02], [115.339, 84.76], [117.079, 86.5]];
export const VIDEO_DURATION = 117.079;
export const storyTime = (t: number) => {
  const M = TIMEMAP;
  if (t <= M[0][0]) return M[0][1];
  for (let i = 1; i < M.length; i++) if (t <= M[i][0]) { const [a, x] = M[i - 1], [b, y] = M[i]; return x + ((t - a) / (b - a)) * (y - x); }
  return M[M.length - 1][1];
};
