/** A* — f(n) = g(n) + h(n) with a binary min-heap. */
import type { HeuristicId, SearchEvent } from '../types';
import { GridModel, makeHeuristic, type HeuristicFn } from './grid';
import { PriorityQueue } from '../dataStructures/PriorityQueue';
import { makeState, frontierSnapWithPriorities, reconstructPath, pathCost, walkableNeighbors, posStr, type RunConfig } from './common';

const fmt = (x: number) => (Math.round(x * 100) / 100).toString();

/** Tie-break: prefer larger g (deeper toward goal), then lower h. */
type Pri = { f: number; g: number };
const priLess = (a: Pri, b: Pri) => a.f < b.f || (a.f === b.f && a.g > b.g);

export function* astar(
  grid: GridModel,
  cfg: RunConfig,
  heuristicId: HeuristicId,
): Generator<SearchEvent> {
  const state = makeState(grid);
  const startIdx = grid.idx(grid.start);
  const targetIdx = grid.idx(grid.target);
  const h: HeuristicFn = makeHeuristic(heuristicId);

  const open = new PriorityQueue<Pri>(priLess);
  const hOf = new Float64Array(grid.rows * grid.cols);
  const closedSet = new Uint8Array(grid.rows * grid.cols);

  const hStart = h(grid.start, grid.target);
  hOf[startIdx] = hStart;
  state.g[startIdx] = 0;
  state.discoveredOrder[startIdx] = 0;
  state.inFrontier[startIdx] = 1;
  open.enqueue(startIdx, { f: hStart, g: 0 });

  yield {
    type: 'INIT',
    node: grid.start,
    g: 0,
    h: hStart,
    f: hStart,
    message: `A* started — START ${posStr(grid.start)}: g = 0, h = ${fmt(hStart)}, f = ${fmt(hStart)}.`,
    line: 0,
    frontier: [grid.start],
  };
  yield {
    type: 'ADD_TO_FRONTIER',
    node: grid.start,
    g: 0,
    h: hStart,
    f: hStart,
    message: `Inserted START into OPEN with f = ${fmt(hStart)}.`,
    line: 1,
    frontier: [grid.start],
  };

  while (!open.isEmpty()) {
    const top = open.dequeue()!;
    const cur = top.value;

    // Stale heap entry: the node was already closed via a cheaper route.
    if (closedSet[cur]) {
      yield {
        type: 'SKIP',
        node: grid.at(cur),
        g: state.g[cur],
        h: hOf[cur],
        f: top.priority.f,
        message: `Popped ${posStr(grid.at(cur))} from OPEN but it is already CLOSED (stale entry) — skipping.`,
        line: 4,
      };
      continue;
    }
    state.inFrontier[cur] = 0;
    const curPos = grid.at(cur);

    yield {
      type: 'SET_CURRENT',
      node: curPos,
      g: state.g[cur],
      h: hOf[cur],
      f: top.priority.f,
      frontier: frontierSnapWithPriorities(open.snapshot(60).map((i) => [i.value, i.priority.f] as [number, number]), grid.cols).nodes,
          frontierPriorities: open.snapshot(60).map((i) => i.priority.f),
      message: `Selected ${posStr(curPos)} — lowest f = ${fmt(top.priority.f)} in OPEN (g = ${fmt(state.g[cur])}, h = ${fmt(hOf[cur])}).`,
      line: 2,
    };

    closedSet[cur] = 1;
    state.visited[cur] = 1;
    state.visitedOrder[cur] = state.order++;

    if (cur === targetIdx) {
      yield {
        type: 'TARGET_FOUND',
        node: curPos,
        g: state.g[cur],
        message: `TARGET reached with path cost ${fmt(state.g[cur])}. With an admissible & consistent heuristic this route is optimal.`,
        line: 7,
      };
      const path = reconstructPath(state, grid, targetIdx);
      for (const p of path) yield { type: 'PATH_NODE', node: p, message: `Reconstructing path via parent chain…`, line: 7 };
      yield { type: 'FINISHED', message: `Path found! Length ${path.length} nodes, cost ${pathCost(grid, path, cfg)}.`, line: 7 };
      return;
    }

    yield {
      type: 'VISIT',
      node: curPos,
      g: state.g[cur],
      h: hOf[cur],
      f: state.g[cur] + hOf[cur],
      message: `Moved ${posStr(curPos)} to CLOSED (g = ${fmt(state.g[cur])}, h = ${fmt(hOf[cur])}, f = ${fmt(state.g[cur] + hOf[cur])}). Evaluating neighbors.`,
      line: 6,
    };

    for (const nb of walkableNeighbors(grid, cur, cfg)) {
      if (closedSet[nb.idx]) continue;
      const tentativeG = state.g[cur] + nb.cost;
      const hn = h(nb.pos, grid.target);
      yield {
        type: 'EVALUATE',
        node: nb.pos,
        g: tentativeG,
        h: hn,
        f: tentativeG + hn,
        message: `Evaluating neighbor ${posStr(nb.pos)}: tentative g = ${fmt(state.g[cur])} + ${fmt(nb.cost)} = ${fmt(tentativeG)}, h = ${fmt(hn)}, f = ${fmt(tentativeG + hn)}.`,
        line: 9,
      };
      if (tentativeG < state.g[nb.idx]) {
        const oldG = state.g[nb.idx];
        const firstTime = oldG === Infinity;
        state.g[nb.idx] = tentativeG;
        hOf[nb.idx] = hn;
        const f = tentativeG + hn;
        state.parent[nb.idx] = cur;
        state.inFrontier[nb.idx] = 1;
        if (firstTime && state.discoveredOrder[nb.idx] === -1) state.discoveredOrder[nb.idx] = state.order;
        open.enqueue(nb.idx, { f, g: tentativeG });
        yield {
          type: firstTime ? 'ADD_TO_FRONTIER' : 'UPDATE_COST',
          node: nb.pos,
          parent: curPos,
          g: tentativeG,
          h: hn,
          f,
          oldCost: firstTime ? undefined : oldG,
          newCost: tentativeG,
          frontier: frontierSnapWithPriorities(open.snapshot(60).map((i) => [i.value, i.priority.f] as [number, number]), grid.cols).nodes,
          frontierPriorities: open.snapshot(60).map((i) => i.priority.f),
          message: firstTime
            ? `Inserted ${posStr(nb.pos)} into OPEN: g = ${fmt(tentativeG)}, h = ${fmt(hn)}, f = ${fmt(f)}.`
            : `Found a cheaper route to ${posStr(nb.pos)}: g updated ${fmt(oldG)} → ${fmt(tentativeG)}, re-inserted with f = ${fmt(f)}.`,
          line: firstTime ? 15 : 10,
        };
      } else {
        yield {
          type: 'SKIP',
          node: nb.pos,
          g: tentativeG,
          h: hn,
          message: `${posStr(nb.pos)} already has a better g (${fmt(state.g[nb.idx])} ≤ ${fmt(tentativeG)}) — no update needed.`,
          line: 10,
        };
      }
    }
  }

  yield {
    type: 'NO_PATH',
    message: `OPEN is empty. No path exists between START and TARGET. Explored ${state.order} nodes.`,
    line: 16,
  };
}
