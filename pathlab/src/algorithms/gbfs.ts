/** Greedy Best-First — priority = h(n) only. Not optimal by design. */
import type { HeuristicId, SearchEvent } from '../types';
import { GridModel, makeHeuristic } from './grid';
import { PriorityQueue } from '../dataStructures/PriorityQueue';
import { makeState, frontierSnapWithPriorities, reconstructPath, pathCost, walkableNeighbors, posStr, type RunConfig } from './common';

const fmt = (x: number) => (Math.round(x * 100) / 100).toString();

export function* gbfs(
  grid: GridModel,
  cfg: RunConfig,
  heuristicId: HeuristicId,
): Generator<SearchEvent> {
  const state = makeState(grid);
  const startIdx = grid.idx(grid.start);
  const targetIdx = grid.idx(grid.target);
  const h = makeHeuristic(heuristicId);

  const open = new PriorityQueue<number>((a, b) => a < b);
  const closedSet = new Uint8Array(grid.rows * grid.cols);

  const hStart = h(grid.start, grid.target);
  state.discoveredOrder[startIdx] = 0;
  state.inFrontier[startIdx] = 1;
  open.enqueue(startIdx, hStart);

  yield {
    type: 'INIT',
    node: grid.start,
    h: hStart,
    message: `GBFS started — inserting START ${posStr(grid.start)} with priority h = ${fmt(hStart)}.`,
    line: 0,
    frontier: [grid.start],
  };

  while (!open.isEmpty()) {
    const top = open.dequeue()!;
    const cur = top.value;
    if (closedSet[cur]) {
      yield {
        type: 'REMOVE_FROM_FRONTIER',
        node: grid.at(cur),
        message: `Skipped stale entry for ${posStr(grid.at(cur))} — already closed.`,
        line: 4,
      };
      continue;
    }
    state.inFrontier[cur] = 0;
    const curPos = grid.at(cur);

    yield {
      type: 'SET_CURRENT',
      node: curPos,
      h: top.priority,
      frontier: frontierSnapWithPriorities(open.snapshot(60).map((i) => [i.value, i.priority] as [number, number]), grid.cols).nodes,
          frontierPriorities: open.snapshot(60).map((i) => i.priority),
      message: `Selected ${posStr(curPos)} — smallest h = ${fmt(top.priority)} (greedy: closest to goal by estimate).`,
      line: 2,
    };

    closedSet[cur] = 1;
    state.visited[cur] = 1;
    state.visitedOrder[cur] = state.order++;

    if (cur === targetIdx) {
      yield {
        type: 'TARGET_FOUND',
        node: curPos,
        message: `TARGET reached. GBFS is fast and directed but this path may be sub-optimal.`,
        line: 7,
      };
      const path = reconstructPath(state, grid, targetIdx);
      for (const p of path) yield { type: 'PATH_NODE', node: p, message: `Reconstructing path via parent chain…`, line: 7 };
      yield { type: 'FINISHED', message: `Path found! Length ${path.length} nodes, cost ${pathCost(grid, path, cfg)}.`, line: 7 };
      return;
    }

    yield { type: 'VISIT', node: curPos, h: top.priority, message: `Closed ${posStr(curPos)} (h = ${fmt(top.priority)}). Expanding neighbors by heuristic promise.`, line: 6 };

    for (const nb of walkableNeighbors(grid, cur, cfg)) {
      if (closedSet[nb.idx] || state.inFrontier[nb.idx]) continue;
      const hn = h(nb.pos, grid.target);
      state.parent[nb.idx] = cur; // first-seen wins — no re-evaluation of g
      state.inFrontier[nb.idx] = 1;
      if (state.discoveredOrder[nb.idx] === -1) state.discoveredOrder[nb.idx] = state.order;
      open.enqueue(nb.idx, hn);
      yield {
        type: 'ADD_TO_FRONTIER',
        node: nb.pos,
        parent: curPos,
        h: hn,
        frontier: frontierSnapWithPriorities(open.snapshot(60).map((i) => [i.value, i.priority] as [number, number]), grid.cols).nodes,
          frontierPriorities: open.snapshot(60).map((i) => i.priority),
        message: `Inserted ${posStr(nb.pos)} into OPEN with priority h = ${fmt(hn)}.`,
        line: 10,
      };
    }
  }

  yield {
    type: 'NO_PATH',
    message: `OPEN empty. No path exists between START and TARGET. Explored ${state.order} nodes.`,
    line: 11,
  };
}
