/** BFS — queue-based level-by-level expansion. */
import type { SearchEvent } from '../types';
import { GridModel } from './grid';
import { makeState, frontierSnapshot, reconstructPath, pathCost, walkableNeighbors, posStr, type RunConfig } from './common';

export function* bfs(grid: GridModel, cfg: RunConfig): Generator<SearchEvent> {
  const state = makeState(grid);
  const startIdx = grid.idx(grid.start);
  const targetIdx = grid.idx(grid.target);

  const depth = new Int32Array(grid.rows * grid.cols).fill(-1);
  const queue: number[] = [startIdx];
  let head = 0; // index pointer instead of O(n) shift()
  state.inFrontier[startIdx] = 1;
  state.discoveredOrder[startIdx] = 0;
  state.g[startIdx] = 0;
  depth[startIdx] = 0;

  yield {
    type: 'INIT',
    node: grid.start,
    message: `BFS started — enqueueing START ${posStr(grid.start)} at depth 0.`,
    line: 0,
    frontier: [grid.start],
  };

  while (head < queue.length) {
    const cur = queue[head++];
    state.inFrontier[cur] = 0;
    const curPos = grid.at(cur);
    yield {
      type: 'SET_CURRENT',
      node: curPos,
      depth: depth[cur],
      frontier: frontierSnapshot(queue.slice(head), grid.cols),
      frontierComplete: true,
      message: `Dequeued ${posStr(curPos)} from the FRONT of the queue (depth ${depth[cur]}).`,
      line: 3,
    };

    if (cur === targetIdx) {
      yield { type: 'TARGET_FOUND', node: curPos, depth: depth[cur], message: `TARGET reached at depth ${depth[cur]} — shortest edge-count path guaranteed on this unweighted graph.`, line: 5 };
      const path = reconstructPath(state, grid, targetIdx);
      for (const p of path) yield { type: 'PATH_NODE', node: p, message: `Reconstructing path via parent chain…`, line: 5 };
      yield {
        type: 'FINISHED',
        message: `Path found! Length ${path.length} nodes, cost ${pathCost(grid, path, cfg)}.`,
        line: 5,
      };
      return;
    }

    state.visited[cur] = 1;
    state.visitedOrder[cur] = state.order++;
    yield {
      type: 'VISIT',
      node: curPos,
      depth: depth[cur],
      message: `Visited ${posStr(curPos)} at depth ${depth[cur]}. Expanding its neighbors.`,
      line: 6,
    };

    for (const nb of walkableNeighbors(grid, cur, cfg)) {
      if (state.discoveredOrder[nb.idx] !== -1 || state.visited[nb.idx]) continue;
      state.discoveredOrder[nb.idx] = state.order;
      state.parent[nb.idx] = cur;
      state.inFrontier[nb.idx] = 1;
      depth[nb.idx] = depth[cur] + 1;
      state.g[nb.idx] = depth[nb.idx];
      queue.push(nb.idx);
      yield {
        type: 'DISCOVER',
        node: nb.pos,
        parent: curPos,
        depth: depth[nb.idx],
        g: depth[nb.idx],
        frontier: frontierSnapshot(queue.slice(head), grid.cols),
        frontierComplete: true,
        message: `Discovered ${posStr(nb.pos)} — added to the BACK of the queue at depth ${depth[nb.idx]}.`,
        line: 11,
      };
    }
  }

  yield {
    type: 'NO_PATH',
    message: `Queue is empty. No path exists between START and TARGET. Explored ${state.order} nodes.`,
    line: 12,
  };
}
