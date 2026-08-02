const MIN_COLS = 2;
const MAX_COLS = 500;
const MIN_ROWS = 2;
const MAX_ROWS = 250;

function validateResize({ cols, rows }) {
  const normalized = { cols: Number(cols), rows: Number(rows) };
  if (!Number.isInteger(normalized.cols) || !Number.isInteger(normalized.rows)) throw new Error("Terminal size must use integer columns and rows.");
  if (normalized.cols < MIN_COLS || normalized.cols > MAX_COLS || normalized.rows < MIN_ROWS || normalized.rows > MAX_ROWS) throw new Error("Terminal size is outside the supported range.");
  return normalized;
}

function outputSequencer(onMessage) {
  let sequence = 0;
  return {
    next(data) { sequence += 1; onMessage({ type: "output", sequence, data }); return sequence; },
    current() { return sequence; },
  };
}

module.exports = { validateResize, outputSequencer };
