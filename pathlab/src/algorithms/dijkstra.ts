/** Dijkstra — min-heap on accumulated distance, with edge relaxation. */
import type { SearchEvent } from '../types';
import { GridModel } from './grid';
import { PriorityQueue } from '../dataStructures/PriorityQueue';
import { makeState, frontierSnapWithPriorities, reconstructPath, pathCost, walkableNeighbors, posStr, type RunConfig } from './common';

const fmt = (x: number) => (Math.round(x * 100) / 100).toString();

export function* dijkstra(grid: GridModel, cfg: RunConfig): Generator<SearchEvent> {
  const state = makeState(grid);
  const startIdx = grid.idx(grid.start);
  const targetIdx = grid.idx(grid.target);

  const pq = new PriorityQueue<number>((a, b) => a < b);
  state.g[startIdx] = 0;
  state.discoveredOrder[startIdx] = 0;
  state.inFrontier[startIdx] = 1;
  pq.enqueue(startIdx, 0);

  yield {
    type: 'INIT',
    node: grid.start,
    g: 0,
    message: `Dijkstra started — dist(${posStr(grid.start)}) = 0 inserted into the priority queue.`,
    line: 0,
    frontier: [grid.start],
  };

  while (!pq.isEmpty()) {
    const top = pq.dequeue()!;
    const cur = top.value;

    // Stale heap entry: a cheaper distance has already been settled.
    if (state.visited[cur]) {
      yield {
        type: 'BACKTRACK',
        node: grid.at(cur),
        g: state.g[cur],
        message: `Popped ${posStr(grid.at(cur))} but it is already settled (stale entry d = ${fmt(top.priority)} ≥ ${fmt(state.g[cur])}) — skipping.`,
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
      frontier: frontierSnapWithPriorities(pq.snapshot(60).map((i) => [i.value, i.priority] as [number, number]), grid.cols).nodes,
          frontierPriorities: pq.snapshot(60).map((i) => i.priority),
      message: `Extracted minimum: ${posStr(curPos)} with the smallest known distance d = ${fmt(state.g[cur])}.`,
      line: 2,
    };

    state.visited[cur] = 1;
    state.visitedOrder[cur] = state.order++;

    if (cur === targetIdx) {
      yield { type: 'TARGET_FOUND', node: curPos, g: state.g[cur], message: `TARGET settled at total cost ${fmt(state.g[cur])} — this is provably minimal for non-negative costs.`, line: 7 };
      const path = reconstructPath(state, grid, targetIdx);
      for (const p of path) yield { type: 'PATH_NODE', node: p, message: `Reconstructing path via parent chain…`, line: 7 };
      yield { type: 'FINISHED', message: `Path found! Length ${path.length} nodes, cost ${pathCost(grid, path, cfg)}.`, line: 7 };
      return;
    }

    yield { type: 'VISIT', node: curPos, g: state.g[cur], message: `Settled ${posStr(curPos)} (d = ${fmt(state.g[cur])}). Relaxing outgoing edges.`, line: 5 };

    for (const nb of walkableNeighbors(grid, cur, cfg)) {
      if (state.visited[nb.idx]) continue;
      const alt = state.g[cur] + nb.cost;
      yield {
        type: 'EVALUATE',
        node: nb.pos,
        g: alt,
        message: `Evaluating neighbor ${posStr(nb.pos)}: tentative dist = ${fmt(state.g[cur])} + ${fmt(nb.cost)} = ${fmt(alt)}.`,
        line: 8,
      };
      if (alt < state.g[nb.idx]) {
        const old = state.g[nb.idx];
        const firstTime = old === Infinity;
        state.g[nb.idx] = alt;
        state.parent[nb.idx] = cur;
        state.inFrontier[nb.idx] = 1;
        if (firstTime && state.discoveredOrder[nb.idx] === -1) state.discoveredOrder[nb.idx] = state.order;
        pq.enqueue(nb.idx, alt);
        yield {
          type: firstTime ? 'DISCOVER' : 'UPDATE_COST',
          node: nb.pos,
          parent: curPos,
          g: alt,
          oldCost: firstTime ? undefined : old,
          newCost: alt,
          frontier: frontierSnapWithPriorities(pq.snapshot(60).map((i) => [i.value, i.priority] as [number, number]), grid.cols).nodes,
          frontierPriorities: pq.snapshot(60).map((i) => i.priority),
          message: firstTime
            ? `Discovered ${posStr(nb.pos)} with tentative distance ${fmt(alt)} (via ${posStr(curPos)}, edge cost ${fmt(nb.cost)}).`
            : `Relaxed edge → cheaper route to ${posStr(nb.pos)}: distance updated from ${fmt(old)} to ${fmt(alt)}.`,
          line: firstTime ? 12 : 9,
        };
      } else {
        yield {
          type: 'SKIP',
          node: nb.pos,
          g: alt,
          message: `${posStr(nb.pos)} keeps its better known distance ${fmt(state.g[nb.idx])} ≤ ${fmt(alt)} — no update.`,
          line: 9,
        };
      }
    }
  }

  yield {
    type: 'NO_PATH',
    message: `Priority queue empty. No path exists between START and TARGET. Explored ${state.order} nodes.`,
    line: 13,
  };
}
