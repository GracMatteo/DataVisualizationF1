/** Outcome keys and labels shared by the model and UI. Colors belong to the UI. */
export const OUTCOME_LEGEND = Object.freeze(Object.fromEntries(
  Object.entries({
    finished: { label: 'Finished', resultLabel: 'Finished' },
    retired: { label: 'Retired / did not finish', resultLabel: 'DNF' },
    dsq: { label: 'Disqualified', resultLabel: 'DSQ' },
    dnq: { label: 'Did not qualify / prequalify', resultLabel: 'DNQ' },
    dns: { label: 'Did not start / withdrew', resultLabel: 'DNS' },
    exc: { label: 'Excluded', resultLabel: 'EXC' },
    nc: { label: 'Not classified', resultLabel: 'NC' },
    unknown: { label: 'Unknown', resultLabel: 'Unknown' },
  }).map(([key, value]) => [key, Object.freeze(value)]),
));

const CODE_OUTCOMES = { D: 'dsq', F: 'dnq', W: 'dns', E: 'exc', N: 'nc' };

/**
 * Use normalized results.position for P labels, never positionOrder or the
 * numeric positionText. Classification and finishing status are independent:
 * a classified retirement keeps its P label but has outcome 'retired'.
 */
export function classifyRaceResult(result, status = result.status ?? null) {
  const code = String(result.positionText ?? '').trim().toUpperCase();
  const statusText = String(status ?? '').trim();
  const hasPosition = Number.isFinite(result.position) && result.position > 0;
  const finished = /^finished$/i.test(statusText)
    || /^\+\s*\d+\s+lap(?:s|\(s\))?$/i.test(statusText);

  let outcome;
  // Explicit classification codes trump generic mechanical/lapped statuses.
  if (Object.hasOwn(CODE_OUTCOMES, code)) outcome = CODE_OUTCOMES[code];
  else if (/disqualified|underweight/i.test(statusText)) outcome = 'dsq';
  else if (/excluded/i.test(statusText)) outcome = 'exc';
  else if (/did not (?:pre)?qualify|107%/i.test(statusText)) outcome = 'dnq';
  else if (/not classified/i.test(statusText)) outcome = 'nc';
  else if (/did not start/i.test(statusText)) outcome = 'dns';
  else if (finished) outcome = 'finished';
  else if (code === 'R') outcome = 'retired';
  else if (/withdrew|withdrawn/i.test(statusText)) outcome = hasPosition ? 'retired' : 'dns';
  else if (statusText && !/^unknown$/i.test(statusText)) outcome = 'retired';
  else outcome = 'unknown';

  return {
    outcome,
    resultLabel: hasPosition ? `P${result.position}` : OUTCOME_LEGEND[outcome].resultLabel,
  };
}
