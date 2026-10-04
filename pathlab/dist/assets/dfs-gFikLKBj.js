const t=`/** DFS — explicit stack, deep-first exploration with visible backtracking. */
import type { SearchEvent } from '../types';
import { GridModel } from './grid';
import { makeState, frontierSnapshot, reconstructPath, pathCost, walkableNeighbors, posStr, type RunConfig } from './common';

export function* dfs(grid: GridModel, cfg: RunConfig): Generator<SearchEvent> {
  const state = makeState(grid);
  const startIdx = grid.idx(grid.start);
  const targetIdx = grid.idx(grid.target);

  const depthOf = new Int32Array(grid.rows * grid.cols).fill(0);
  // Stack holds {idx}; we push start and mark discovered on push.
  const stack: number[] = [startIdx];
  state.discoveredOrder[startIdx] = 0;
  state.inFrontier[startIdx] = 1;

  yield {
    type: 'INIT',
    node: grid.start,
    message: \`DFS started — pushing START \${posStr(grid.start)} onto the stack.\`,
    line: 0,
    frontier: [grid.start],
  };

  while (stack.length > 0) {
    const cur = stack.pop()!;
    state.inFrontier[cur] = 0;
    const curPos = grid.at(cur);

    if (state.visited[cur]) {
      yield {
        type: 'BACKTRACK',
        node: curPos,
        depth: depthOf[cur],
        frontier: frontierSnapshot([...stack].reverse(), grid.cols), frontierComplete: true,
        message: \`Popped \${posStr(curPos)} but it was already visited — backtracking.\`,
        line: 4,
      };
      continue;
    }

    yield {
      type: 'SET_CURRENT',
      node: curPos,
      depth: depthOf[cur],
      frontier: frontierSnapshot([...stack].reverse(), grid.cols), frontierComplete: true,
      message: \`Popped \${posStr(curPos)} from the TOP of the stack (depth \${depthOf[cur]}).\`,
      line: 2,
    };

    state.visited[cur] = 1;
    state.visitedOrder[cur] = state.order++;

    if (cur === targetIdx) {
      yield { type: 'TARGET_FOUND', node: curPos, depth: depthOf[cur], message: \`TARGET found at depth \${depthOf[cur]}. Note: DFS does NOT guarantee this is a shortest path.\`, line: 7 };
      const path = reconstructPath(state, grid, targetIdx);
      for (const p of path) yield { type: 'PATH_NODE', node: p, message: \`Reconstructing path via parent chain…\`, line: 7 };
      yield { type: 'FINISHED', message: \`Path found! Length \${path.length} nodes, cost \${pathCost(grid, path, cfg)}.\`, line: 7 };
      return;
    }

    yield {
      type: 'VISIT',
      node: curPos,
      depth: depthOf[cur],
      message: \`Visited \${posStr(curPos)} at depth \${depthOf[cur]}.\`,
      line: 5,
    };

    // Push in reverse so the first neighbor direction is explored first (LIFO).
    const nbs = walkableNeighbors(grid, cur, cfg);
    for (let i = nbs.length - 1; i >= 0; i--) {
      const nb = nbs[i];
      if (state.visited[nb.idx]) continue;
      state.parent[nb.idx] = cur;
      state.inFrontier[nb.idx] = 1;
      depthOf[nb.idx] = depthOf[cur] + 1;
      if (state.discoveredOrder[nb.idx] === -1) state.discoveredOrder[nb.idx] = state.order;
      stack.push(nb.idx);
      yield {
        type: 'DISCOVER',
        node: nb.pos,
        parent: curPos,
        depth: depthOf[nb.idx],
        frontier: frontierSnapshot([...stack].reverse(), grid.cols), frontierComplete: true,
        message: \`Pushed \${posStr(nb.pos)} onto the stack — DFS moves deeper to depth \${depthOf[nb.idx]}.\`,
        line: 11,
      };
    }
  }

  yield {
    type: 'NO_PATH',
    message: \`Stack is empty. No path exists between START and TARGET. Explored \${state.order} nodes.\`,
    line: 12,
  };
}
`;export{t as default};
