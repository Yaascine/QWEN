import { GridModel } from '/workspace/pathlab/src/algorithms/grid';
import { bfs } from '/workspace/pathlab/src/algorithms/bfs';
import { dijkstra } from '/workspace/pathlab/src/algorithms/dijkstra';
import type { SearchEvent, Pos } from '/workspace/pathlab/src/types';

const CFG = { diagonal: false, cornerCutting: false };
function runGen(gen: Generator<SearchEvent>): SearchEvent[] { const o: SearchEvent[]=[]; for (const e of gen) o.push(e); return o; }
const P = (r:number,c:number):Pos=>({row:r,col:c});

// BFS-D: 5x4, target (2,3), wall at (1,2). Expect BACKTRACK on stale pop of (2,2).
{
  const g = new GridModel(5, 4, P(0,0), P(2,3));
  g.setWall(g.idx(P(1,2)));
  const evs = runGen(bfs(g, CFG));
  const bt = evs.filter(e=>e.type==='BACKTRACK');
  console.log('BFS-D found:', !!evs.find(e=>e.type==='TARGET_FOUND'), 'backtrack:', bt.length, bt.map(e=>`(${e.node!.row},${e.node!.col})`).join(','));
}
// DIJ-N: 3x5 start(1,0) target(1,4), weight5 at (1,1). Expect UPDATE_COST (1,1): 5->3.
{
  const g = new GridModel(3, 5, P(1,0), P(1,4));
  g.setWeight(g.idx(P(1,1)), 5);
  const evs = runGen(dijkstra(g, CFG));
  const ups = evs.filter(e=>e.type==='UPDATE_COST');
  console.log('DIJ-N updates:', ups.length, ups.map(e=>`(${e.node!.row},${e.node!.col}) ${e.oldCost}->${e.newCost}`).join(','));
}
