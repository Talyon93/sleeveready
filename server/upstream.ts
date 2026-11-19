// How long one upstream request (Scryfall, TCGdex, Bandai, …) may take.
//
// Netlify ends a synchronous function after 10 seconds by default. An upstream call that waits longer cannot succeed
// there: the platform kills the function, bills the whole time and answers its own 502 instead of the app's error.
// So inside a function every call, retries included, gets at most UPSTREAM_BUDGET_MS (9 s unless set). Scripts run
// from a terminal (index refreshes, page generation) keep the longer per-source timeouts.
const inFunction = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const configured = Number(process.env.UPSTREAM_BUDGET_MS);

export const upstreamBudgetMs = Number.isFinite(configured) && configured > 0
  ? configured
  : inFunction
  ? 9_000
  : 60_000;

/**
 * An abort signal for one upstream attempt: the source's own timeout, capped by what is left of the budget.
 * `started` is when the first attempt began, so retries share the budget instead of each getting a full one.
 */
export function upstreamSignal(ms: number, started = Date.now())
{
  const left = started + upstreamBudgetMs - Date.now();
  return AbortSignal.timeout(Math.max(500, Math.min(ms, left)));
}

/** Whether a retry still fits: fewer than three attempts and at least two seconds of budget left. */
export const retryWithin = (started: number, attempt: number) =>
  attempt < 2 && started + upstreamBudgetMs - Date.now() > 2_000;
